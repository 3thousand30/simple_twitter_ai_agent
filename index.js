const axios = require('axios');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');

// Initialize AWS services (reused across warm Lambda invocations)
const dynamoClient = new DynamoDBClient();
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const secretsManager = new SecretsManagerClient();

const { PERSONA } = require('./persona');

// Define main themes with descriptions and their sub-themes.
// You can have as many as you want, but keep it reasonable for the bot's focus.
const THEMES = {
  "Theme1": {
    description: "describe Theme1 content here.",
    subThemes: ["Subtheme1", "Subtheme2", "Subtheme3", "Subtheme4", "Subtheme5"]
  },
  "Theme2": {
    description: "describe Theme2 content here.",
    subThemes: ["Subtheme6", "Subtheme7", "Subtheme8", "Subtheme9", "Subtheme10"]
  },
  "Theme3": {
    description: "describe Theme3 content here.",
    subThemes: ["Subtheme11", "Subtheme12", "Subtheme13", "Subtheme14", "Subtheme15"]
  },
  "Theme4": {
    description: "describe Theme4 content here.",
    subThemes: ["Subtheme16", "Subtheme17", "Subtheme18", "Subtheme19", "Subtheme20"]
  },
  "Theme5": {
    description: "describe Theme5 content here.",
    subThemes: ["Subtheme21", "Subtheme22", "Subtheme23", "Subtheme24", "Subtheme25"]
  }
};

// Tracking state across executions
const STATE_TABLE = process.env.STATE_TABLE || 'TwitterBotState';
const SAMPLE_TWEETS_TABLE = process.env.SAMPLE_TWEETS_TABLE || 'TwitterBotSampleTweets';

// Configuration
const TWEETS_PER_EXECUTION = 3;
const TWEETS_PER_SUBTHEME = 3;
const TOTAL_TWEETS_PER_DAY = 15;

exports.handler = async (event) => {
  try {
    // Get the current posting state
    const state = await getCurrentState();

    // Log cycle progress for monitoring
    const progress = getCycleProgress(state);
    console.log(`Cycle Progress: ${progress.progressPercentage}% (${progress.completedSubThemes}/${progress.totalSubThemes} sub-themes)`);
    console.log(`Current: ${progress.currentPosition} (${progress.tweetsInCurrentSubTheme}/${TWEETS_PER_SUBTHEME} tweets)`);
    console.log(`Full cycle takes ~${progress.cycleDays} days`);

    // Get sample tweets from DynamoDB
    const sampleTweets = await getSampleTweets();

    // Get API credentials
    const credentials = await getCredentials();

    // Determine which theme and subtheme to use
    const { mainTheme, subTheme, currentSubThemeCount } = state;

    console.log(`Generating tweets for theme: ${mainTheme} - ${subTheme}`);
    console.log(`Tweets posted today: ${state.tweetsPostedToday}, Current subtheme count: ${currentSubThemeCount}`);

    // Only generate as many tweets as needed to complete the current subtheme
    const tweetsToGenerate = Math.min(TWEETS_PER_EXECUTION, TWEETS_PER_SUBTHEME - currentSubThemeCount);

    // Filter sample tweets for the current subtheme
    const relevantSampleTweets = sampleTweets.filter(tweet =>
      tweet.toLowerCase().includes(`#${subTheme.toLowerCase()}`)
    );

    console.log(`Found ${relevantSampleTweets.length} relevant sample tweets for ${subTheme}`);

    // Generate tweets using AI
    const tweets = await generateTweets(
      mainTheme,
      subTheme,
      THEMES[mainTheme].description,
      relevantSampleTweets,
      tweetsToGenerate,
      credentials.ai_provider_api_key
    );

    console.log(`Generated ${tweets.length} tweets`);

    // Reset daily counter if it's a new day
    const today = new Date().toDateString();
    if (today !== state.currentDay) {
      state.tweetsPostedToday = 0;
      state.currentDay = today;
    }

    // Post tweets and persist progress after each successful post
    const postedTweets = [];
    for (let i = 0; i < tweets.length; i++) {
      await postTweet(
        tweets[i],
        credentials.twitter_api_key,
        credentials.twitter_api_secret,
        credentials.twitter_access_token,
        credentials.twitter_access_token_secret
      );
      postedTweets.push(tweets[i]);

      // Save progress incrementally so partial failures don't lose state
      state.currentSubThemeCount += 1;
      state.tweetsPostedToday += 1;
      await updateState(state);

      // Delay between tweets to appear more natural (skip after last tweet)
      if (i < tweets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    // Advance to next subtheme if current one is complete
    const newState = calculateNextState(state);
    await updateState(newState);

    // Log the new state for monitoring
    const newProgress = getCycleProgress(newState);
    console.log(`Updated to: ${newProgress.currentPosition}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully posted ${postedTweets.length} tweets for theme: ${mainTheme} - ${subTheme}`,
        theme: `${mainTheme} - ${subTheme}`,
        tweets: postedTweets,
        newState,
        progress: newProgress
      }),
    };
  } catch (error) {
    console.error('Error in Lambda function:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing Twitter posting task',
        error: error.message,
      }),
    };
  }
};

// Get current state from DynamoDB
async function getCurrentState() {
  const result = await dynamoDB.send(new GetCommand({
    TableName: STATE_TABLE,
    Key: { id: 'current_state' }
  }));

  if (result.Item) {
    return result.Item;
  }

  // If no state exists, initialize with default values
  const initialState = initializeState();
  await updateState(initialState);
  return initialState;
}

// Initialize state with default values
function initializeState() {
  const mainThemes = Object.keys(THEMES);
  const firstMainTheme = mainThemes[0];

  return {
    mainTheme: firstMainTheme,
    subTheme: THEMES[firstMainTheme].subThemes[0],
    tweetsPostedToday: 0,
    currentSubThemeCount: 0,
    lastUpdated: new Date().toISOString(),
    currentDay: new Date().toDateString()
  };
}

// Update state in DynamoDB
async function updateState(state) {
  await dynamoDB.send(new PutCommand({
    TableName: STATE_TABLE,
    Item: {
      id: 'current_state',
      ...state,
      lastUpdated: new Date().toISOString()
    }
  }));
}

// Advance to next subtheme if current one is complete, otherwise return current state
function calculateNextState(currentState) {
  if (currentState.currentSubThemeCount < TWEETS_PER_SUBTHEME) {
    return currentState;
  }

  const { mainTheme, subTheme } = currentState;
  const mainThemes = Object.keys(THEMES);
  const currentMainThemeIndex = mainThemes.indexOf(mainTheme);
  const currentSubThemes = THEMES[mainTheme].subThemes;
  const currentSubThemeIndex = currentSubThemes.indexOf(subTheme);

  // Move to the next subtheme within the same main theme
  if (currentSubThemeIndex + 1 < currentSubThemes.length) {
    return {
      ...currentState,
      subTheme: currentSubThemes[currentSubThemeIndex + 1],
      currentSubThemeCount: 0
    };
  }

  // Move to the next main theme (wraps around)
  const nextMainThemeIndex = (currentMainThemeIndex + 1) % mainThemes.length;
  const nextMainTheme = mainThemes[nextMainThemeIndex];

  return {
    ...currentState,
    mainTheme: nextMainTheme,
    subTheme: THEMES[nextMainTheme].subThemes[0],
    currentSubThemeCount: 0
  };
}

// Get cycle progress for monitoring
function getCycleProgress(currentState) {
  const mainThemes = Object.keys(THEMES);
  const currentMainThemeIndex = mainThemes.indexOf(currentState.mainTheme);
  const currentSubThemeIndex = THEMES[currentState.mainTheme].subThemes.indexOf(currentState.subTheme);

  // Calculate totals dynamically (works with any number of subthemes per theme)
  let completedSubThemes = 0;
  for (let i = 0; i < currentMainThemeIndex; i++) {
    completedSubThemes += THEMES[mainThemes[i]].subThemes.length;
  }
  completedSubThemes += currentSubThemeIndex;

  const totalSubThemes = mainThemes.reduce((sum, theme) => sum + THEMES[theme].subThemes.length, 0);
  const progressPercentage = Math.round((completedSubThemes / totalSubThemes) * 100);

  return {
    currentPosition: `${currentState.mainTheme} -> ${currentState.subTheme}`,
    completedSubThemes: completedSubThemes,
    totalSubThemes: totalSubThemes,
    progressPercentage: progressPercentage,
    tweetsInCurrentSubTheme: currentState.currentSubThemeCount,
    cycleDays: Math.ceil(totalSubThemes * TWEETS_PER_SUBTHEME / TOTAL_TWEETS_PER_DAY)
  };
}

// Get sample tweets from DynamoDB
async function getSampleTweets() {
  try {
    const result = await dynamoDB.send(new ScanCommand({
      TableName: SAMPLE_TWEETS_TABLE
    }));

    return result.Items.map(item => item.text);
  } catch (error) {
    console.error('Error getting sample tweets:', error);
    return [];
  }
}

// Get API credentials from Secrets Manager
async function getCredentials() {
  const result = await secretsManager.send(new GetSecretValueCommand({
    SecretId: process.env.SECRET_NAME,
  }));

  return JSON.parse(result.SecretString);
}

// Generate tweets using AI provider (Anthropic Claude)
async function generateTweets(mainTheme, subTheme, themeDescription, sampleTweets, count, apiKey) {
  // Construct the prompt
  const prompt = constructPrompt(mainTheme, subTheme, themeDescription, sampleTweets, count);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    // Extract tweets from the AI response
    return extractTweets(response.data.content[0].text);
  } catch (error) {
    console.error('Error generating tweets with AI:', error);
    throw error;
  }
}

// Construct the prompt for AI tweet generation
function constructPrompt(mainTheme, subTheme, themeDescription, sampleTweets, count) {
  const sampleTweetsText = sampleTweets.length > 0
    ? `Here are some sample tweets for this theme:\n${sampleTweets.join('\n')}`
    : 'No specific sample tweets are available for this exact subtheme, but please follow the overall style patterns from the main theme.';

  return `
You are ${PERSONA.identity.name}, ${PERSONA.identity.role}. ${PERSONA.identity.approach}.

YOUR CHARACTER:
${PERSONA.character.strengths.map(s => `- ${s}`).join('\n')}

YOUR CORE BELIEFS:
${PERSONA.beliefs.map(b => `- ${b}`).join('\n')}

YOUR VOICE:
- Tone: ${PERSONA.voice.tone}
- Style: ${PERSONA.voice.style.join(', ')}
- Language: ${PERSONA.voice.language}

WHAT TO AVOID:
${PERSONA.avoids.map(a => `- ${a}`).join('\n')}

---

TASK: Generate ${count} tweets about the main theme "${mainTheme}" and specifically the sub-theme "${subTheme}".

CONTEXT:
- Main theme: ${mainTheme}
- Main theme description: ${themeDescription}
- Current sub-theme: ${subTheme}

${sampleTweetsText}

CONTENT REQUIREMENTS:
- Each tweet must be 100-280 characters
- Include hashtag #${subTheme} naturally in the content
- NO additional hashtags beyond #${subTheme}
- NO emojis
- Focus specifically on "${subTheme}" within the broader "${mainTheme}" context
- Embody persona's voice.

VARIATION REQUIREMENTS:
- Use different structures (questions, statements, observations, challenges)
- Vary sentence length and complexity
- Mix different angles on the sub-theme
- Ensure no two tweets feel repetitive
- Each tweet should provide unique value or perspective

Generate tweets that reflect persona's character—wise.

OUTPUT FORMAT:
Return exactly ${count} unique tweets about ${subTheme}, each on a new line prefixed with "TWEET: ".
  `;
}

// Extract tweets from AI response
function extractTweets(response) {
  const lines = response.split('\n');
  const tweets = [];

  for (const line of lines) {
    if (line.startsWith('TWEET: ')) {
      const tweet = line.replace('TWEET: ', '').trim();
      if (tweet && tweet.length <= 280) {
        tweets.push(tweet);
      }
    }
  }

  return tweets;
}

// Post a tweet to Twitter/X using OAuth 1.0a
async function postTweet(content, apiKey, apiSecret, accessToken, accessTokenSecret) {
  try {
    // Create OAuth 1.0a instance
    const oauth = OAuth({
      consumer: {
        key: apiKey,
        secret: apiSecret
      },
      signature_method: 'HMAC-SHA1',
      hash_function(baseString, key) {
        return crypto
          .createHmac('sha1', key)
          .update(baseString)
          .digest('base64');
      }
    });

    // Request data
    const requestData = {
      url: 'https://api.twitter.com/2/tweets',
      method: 'POST'
    };

    // Generate authorization header
    const authHeader = oauth.toHeader(oauth.authorize(requestData, {
      key: accessToken,
      secret: accessTokenSecret
    }));

    // Post the tweet
    await axios({
      url: requestData.url,
      method: requestData.method,
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      data: {
        text: content
      }
    });

    console.log('Successfully posted tweet:', content);
  } catch (error) {
    console.error('Error posting tweet:', error);
    throw error;
  }
}
