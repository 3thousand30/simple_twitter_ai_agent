# AI Twitter Posting Agent (Educational Project)

A ready-to-use agent that shows how AI can post content on Twitter (X). By default it generates up to **30 tweets per day** across four themes, using sample tweets to capture brand voice and maintain variety. The number of posts can be adjusted as needed.

This project is mainly for **education and exploration**: a way to learn how to connect large language models (LLMs) with simple agents, apply basic MLP-style functionality, and see how posting automation works in practice. It goes beyond a basic POC, offering enough structure to be adapted or scaled.

## Important Context

- **Educational purpose**: Learn how to build and run AI-driven posting agents.  
- **Free tier by default**: Operates within X API’s free limits.  
- **Scalable**: Can be extended to the paid tier (from $200/month) or enhanced with more advanced features.  
- **Flexible design**: Modular, serverless setup makes it easy to extend with new themes or providers.  

## 🚀 Capabilities

- **AI content generation**: Uses LLMs to produce varied, natural tweets.  
- **Organised themes and subthemes**: Posts are spread across 4 themes with 5 subthemes each, balancing content and making it easy to adjust or extend.  
- **Configurable posting volume**: Default is 30 tweets per day, but this can be modified to suit your needs.  
- **Voice alignment**: Learns from sample tweets to stay consistent with brand style.  
- **Variation control**: Prompting techniques reduce repetition and improve diversity.  
- **Stateless but progressive**: Each run is independent while still advancing through the theme cycle.  
- **Provider flexibility**: Works with OpenAI, Anthropic, DeepSeek, or any compatible model.  

## 🧠 Prompting & AI Optimization

A key strength of this project is the way it builds prompts for the LLM.  
The `constructPrompt` function combines **context, examples, and explicit rules** to make the output more authentic and varied.  

### What the prompt does
- **Theme awareness**: Passes the current theme, subtheme, and description into the model.  
- **Voice alignment**: Injects sample tweets for style analysis (tone, structure, engagement).  
- **Content rules**: Forces use of one specific hashtag, correct length (100–280 chars), and no unnecessary extras.  
- **Variation techniques**: Encourages mixing of formats (questions, statements, tips), sentence length, and perspectives.  
- **Output format**: Uses a clear instruction (`TWEET:` prefix) so results are easy to parse.  

### Why it matters
- Keeps tweets **consistent with brand voice**.  
- Avoids repetitive structures and content fatigue.  
- Makes the agent adaptable to any dataset of sample tweets.  
- Shows a practical example of **prompt engineering best practices** for real-world tasks.  

This approach can be reused or extended for other AI agents — e.g., blog writing, captions, or LinkedIn posts — where **style and variation** are as important as accuracy.  


## 🏗️ Architecture

Built for AWS Lambda but adaptable to any serverless platform:
- **AWS Lambda**: Serverless execution with scheduled triggers
- **DynamoDB**: State persistence and sample tweet storage
- **Secrets Manager**: Secure credential management
- **EventBridge**: Automated scheduling (every ~5 hours)

## 🔧 Setup

### 1. Database Setup
```bash
node setup-dynamodb.js
```

### 2. Sample Tweets
Add your brand's sample tweets to DynamoDB:
```javascript
const sampleTweets = [
  "Your sample tweet content #SubthemeName",
  // Add 10-20 sample tweets per subtheme
];
```

### 3. Secrets Configuration
Store in AWS Secrets Manager or environment variables:
```json
{
  "twitter_api_key": "your_key",
  "twitter_api_secret": "your_secret", 
  "twitter_access_token": "your_token",
  "twitter_access_token_secret": "your_token_secret",
  "ai_provider": "anthropic|openai|deepseek|custom",
  "ai_provider_api_key": "your_ai_key",
  "ai_model": "model_name"
}
```

## 🤖 LLM Provider Examples

### OpenAI
```javascript
async function generateWithOpenAI(prompt, apiKey, model = 'gpt-3.5-turbo') {
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.8
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.choices[0].message.content;
}
```

### Anthropic Claude
```javascript
async function generateWithAnthropic(prompt, apiKey, model = 'claude-3-haiku-20240307') {
  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: model,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });
  return response.data.content[0].text;
}
```

### DeepSeek
```javascript
async function generateWithDeepSeek(prompt, apiKey, model = 'deepseek-chat') {
  const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.8
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.choices[0].message.content;
}
```

### Custom Model (Generic OpenAI-compatible)
```javascript
async function generateWithCustomModel(prompt, apiKey, baseURL, model) {
  const response = await axios.post(`${baseURL}/v1/chat/completions`, {
    model: model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.8
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.choices[0].message.content;
}
```

## 📋 Configuration

Customize themes in `index.js`:
```javascript
const THEMES = {
  "YourTheme1": {
    description: "Theme description for AI context",
    subThemes: ["Subtheme1", "Subtheme2", "Subtheme3", "Subtheme4", "Subtheme5"]
  },
  // Add 3 more themes...
};
```

## 🚀 Deployment

Use the included `template.yaml` for easy AWS deployment:

```bash
# Build and deploy with AWS SAM
sam build
sam deploy --guided
```

See `DEPLOYMENT.md` for detailed setup instructions including:
- AWS CLI and SAM CLI installation
- Secrets Manager configuration
- Database initialization
- Monitoring and troubleshooting

**Manual AWS Setup (without template):**
- Create Lambda function with Node.js 18.x runtime
- Create 2 DynamoDB tables: `TwitterBotState` and `TwitterBotSampleTweets`
- Set up EventBridge rule for scheduling (every 5 hours)
- Configure environment variables and IAM permissions
- Store credentials in Secrets Manager

Alternative platforms: Vercel, Netlify Functions, Google Cloud Functions, or any Node.js hosting.

## 🔄 Coming Up
Planned Enhancements:
- Recent Tweets Tracking: Add DynamoDB table to store last 'x' tweets and pass to AI prompt for better repetition avoidance.
- Voice Analysis Engine: Implement automatic analysis of sample tweets to extract tone patterns, sentence structures, and engagement techniques for more authentic voice matching.

## 🌟 Live Example

Currently running on [@ProyogiBaba](https://x.com/ProyogiBaba) demonstrating real-world thematic content generation with a custom model. The bot maintains consistent engagement while cycling through diverse content themes.

## 💬 Contact & Contributions

For feedback, questions, or contributions, reach out to [here]((https://github.com/3thousand30/simple_twitter_ai_agent/issues/1)). We welcome community input to improve the AI agent's capabilities and expand its features.

## 📝 License

MIT License - Feel free to adapt for your own projects.
