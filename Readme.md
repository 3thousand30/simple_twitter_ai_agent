# AI-Powered Twitter Agent

An intelligent Twitter posting bot that generates and publishes 30 tweets per day across 4 content themes using AI. The agent analyzes sample tweets to learn brand voice and maintains thematic variety while avoiding repetitive content.

## 🚀 Capabilities

- **AI-Powered Content Generation**: Uses LLM providers to create authentic, varied tweets
- **Thematic Intelligence**: Cycles through 4 main themes with 5 subthemes each (4-5 tweets per subtheme)
- **Sample-Based Generation**: Uses sample tweets as context for maintaining brand voice
- **Smart Variation**: Uses enhanced prompts to ensure variety and avoid repetitive content
- **Stateless Design**: Each execution is independent while maintaining progression logic
- **Provider Agnostic**: Works with OpenAI, Anthropic, DeepSeek, or any custom model

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

Currently running on [@ProyogiBaba](https://x.com/ProyogiBaba) as part of [devyo.life](https://devyo.life), demonstrating real-world thematic content generation with a custom model. The bot maintains consistent engagement while cycling through diverse content themes.

## 💬 Contact & Contributions

For feedback, questions, or contributions, reach out to [hello@devyo.life](mailto:hello@devyo.life). We welcome community input to improve the AI agent's capabilities and expand its features.

## 📝 License

MIT License - Feel free to adapt for your own projects.