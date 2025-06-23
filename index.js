const axios = require('axios');
const AWS = require('aws-sdk');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');

// Initialize AWS services
const secretsManager = new AWS.SecretsManager();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

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

// Number of tweets to generate per execution.
const TWEETS_PER_EXECUTION = 3; // Generate 3 tweets at a time, 5 times per day
const TOTAL_TWEETS_PER_DAY = 15;

exports.handler = async (event) => {
  try {
    // Get the current posting state
    const state = await getCurrentState();
    
    // Log cycle progress for monitoring
    const progress = getCycleProgress(state);
    console.log(`Cycle Progress: ${progress.progressPercentage}% (${progress.completedSubThemes}/${progress.totalSubThemes} sub-themes)`);
    console.log(`Current: ${progress.currentPosition} (${progress.tweetsInCurrentSubTheme}/3 tweets)`);
    console.log(`Full cycle takes ~${progress.cycleDays} days`);
    
    // Get sample tweets from DynamoDB
    const sampleTweets = await getSampleTweets();
    
    // Get API credentials
    const credentials = await getCredentials();
    
    // Determine which theme and subtheme to use
    const { mainTheme, subTheme, tweetsPostedToday, currentSubThemeCount } = state;
    
    console.log(`Generating tweets for theme: ${mainTheme} - ${subTheme}`);
    console.log(`Tweets posted today: ${tweetsPostedToday}, Current subtheme count: ${currentSubThemeCount}`);
    
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
      TWEETS_PER_EXECUTION,
      credentials.ai_provider_api_key
    );
    
    console.log(`Generated ${tweets.length} tweets`);
    
    // Post tweets to Twitter/X with slight delays between them
    const postedTweets = [];
    for (const tweet of tweets) {
      await postTweet(
        tweet, 
        credentials.twitter_api_key,
        credentials.twitter_api_secret,
        credentials.twitter_access_token,
        credentials.twitter_access_token_secret
      );
      postedTweets.push(tweet);
      
      // Add a delay between tweets to appear more natural
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30-second delay
    }
    
    // Update the state for next execution
    const newState = calculateNextState(state, TWEETS_PER_EXECUTION);
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
  try {
    const result = await dynamoDB.get({
      TableName: STATE_TABLE,
      Key: { id: 'current_state' }
    }).promise();
    
    if (result.Item) {
      return result.Item;
    }
    
    // If no state exists, initialize with default values
    const initialState = initializeState();
    await updateState(initialState);
    return initialState;
  } catch (error) {
    console.error('Error getting current state:', error);
    // If there's an error, return a default state
    return initializeState();
  }
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
  await dynamoDB.put({
    TableName: STATE_TABLE,
    Item: {
      id: 'current_state',
      ...state,
      lastUpdated: new Date().toISOString()
    }
  }).promise();
}

// Calculate the next state with multi-day cycling support
function calculateNextState(currentState, tweetsPosted) {
  const { mainTheme, subTheme, tweetsPostedToday, currentSubThemeCount } = currentState;
  
  // Check if it's a new day - but DON'T reset the theme progression
  const today = new Date().toDateString();
  let newTweetsPostedToday = tweetsPostedToday + tweetsPosted;
  
  if (today !== currentState.currentDay) {
    // New day: reset daily counter but KEEP theme progression
    newTweetsPostedToday = tweetsPosted;
  }
  
  // Continue theme progression regardless of day
  const newSubThemeCount = currentSubThemeCount + tweetsPosted;
  
  // If we've posted 3 tweets for this subtheme, move to the next one
  if (newSubThemeCount >= 3) {
    const mainThemes = Object.keys(THEMES);
    const currentMainThemeIndex = mainThemes.indexOf(mainTheme);
    const currentSubThemes = THEMES[mainTheme].subThemes;
    const currentSubThemeIndex = currentSubThemes.indexOf(subTheme);
    
    // Move to the next subtheme
    if (currentSubThemeIndex + 1 < currentSubThemes.length) {
      // Still have subthemes in the current main theme
      return {
        mainTheme,
        subTheme: currentSubThemes[currentSubThemeIndex + 1],
        tweetsPostedToday: newTweetsPostedToday,
        currentSubThemeCount: 0, // Reset sub-theme counter
        currentDay: today
      };
    } else {
      // Move to the next main theme
      const nextMainThemeIndex = (currentMainThemeIndex + 1) % mainThemes.length;
      const nextMainTheme = mainThemes[nextMainThemeIndex];
      
      return {
        mainTheme: nextMainTheme,
        subTheme: THEMES[nextMainTheme].subThemes[0],
        tweetsPostedToday: newTweetsPostedToday,
        currentSubThemeCount: 0, // Reset sub-theme counter
        currentDay: today
      };
    }
  }
  
  // Continue with the same subtheme
  return {
    ...currentState,
    tweetsPostedToday: newTweetsPostedToday,
    currentSubThemeCount: newSubThemeCount,
    currentDay: today
  };
}

// Get cycle progress for monitoring
function getCycleProgress(currentState) {
  const mainThemes = Object.keys(THEMES);
  const currentMainThemeIndex = mainThemes.indexOf(currentState.mainTheme);
  const currentSubThemes = THEMES[currentState.mainTheme].subThemes;
  const currentSubThemeIndex = currentSubThemes.indexOf(currentState.subTheme);
  
  // Calculate total progress through all sub-themes
  const completedSubThemes = currentMainThemeIndex * 5 + currentSubThemeIndex;
  const totalSubThemes = mainThemes.length * 5; // 25 total
  const progressPercentage = Math.round((completedSubThemes / totalSubThemes) * 100);
  
  return {
    currentPosition: `${currentState.mainTheme} -> ${currentState.subTheme}`,
    completedSubThemes: completedSubThemes,
    totalSubThemes: totalSubThemes,
    progressPercentage: progressPercentage,
    tweetsInCurrentSubTheme: currentState.currentSubThemeCount,
    cycleDays: Math.ceil(totalSubThemes * 3 / 15) // 15 tweets per day
  };
}

// Get sample tweets from DynamoDB
async function getSampleTweets() {
  try {
    const result = await dynamoDB.scan({
      TableName: SAMPLE_TWEETS_TABLE
    }).promise();
    
    return result.Items.map(item => item.text);
  } catch (error) {
    console.error('Error getting sample tweets:', error);
    return [];
  }
}

// Get API credentials from Secrets Manager
async function getCredentials() {
  const result = await secretsManager.getSecretValue({
    SecretId: process.env.SECRET_NAME,
  }).promise();
  
  return JSON.parse(result.SecretString);
}

// Generate tweets using AI provider (Anthropic Claude 3 Haiku)
async function generateTweets(mainTheme, subTheme, themeDescription, sampleTweets, count, apiKey) {
  // Construct the prompt
  const prompt = constructPrompt(mainTheme, subTheme, themeDescription, sampleTweets, count);
  
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
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
  You are an expert social media content creator specializing in authentic, engaging Twitter content. Your task is to generate ${count} tweets about the main theme "${mainTheme}" and specifically the sub-theme "${subTheme}".

Additional context:
- Main theme: ${mainTheme}
- Main theme description: ${themeDescription}
- Current sub-theme: ${subTheme}

${sampleTweetsText}

STYLE ANALYSIS INSTRUCTIONS:
1. Analyze the sample tweets for:
   - Tone (professional, casual, humorous, educational, etc.)
   - Sentence structure patterns
   - Use of questions, statements, or calls-to-action
   - Level of technical language vs. accessibility
   - Engagement techniques used

CONTENT REQUIREMENTS:
- Each tweet must be 100-280 characters
- Include hashtag #${subTheme} naturally in the content
- NO additional hashtags beyond #${subTheme}
- NO emojis unless they appear in sample tweets
- Focus specifically on "${subTheme}" within the broader "${mainTheme}" context

VARIATION REQUIREMENTS:
- Use different tweet structures (questions, statements, tips, observations)
- Vary sentence length and complexity
- Mix different angles on the sub-theme
- Ensure no two tweets feel repetitive when read consecutively
- Each tweet should provide unique value or perspective

Generate tweets that feel authentically human while maintaining consistent brand voice.

OUTPUT FORMAT:
Please return exactly ${count} unique, engaging tweets about ${subTheme}, with each tweet on a new line prefixed with "TWEET: ".
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