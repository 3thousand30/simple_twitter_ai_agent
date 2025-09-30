# AI Twitter Posting Agent (Educational Project)

This project shows how to build a simple AI-driven posting agent for Twitter (X).  
By default it generates **15 tweets per day** across multiple themes, using sample tweets to learn tone and style.  

It is designed mainly for **education and exploration**:  
- Learn how to connect large language models (LLMs) with simple agents  
- Apply basic MLP-style functionality in a practical setting  
- See how scheduling, state management, and prompt design work in practice  

The setup is ready to run but also easy to extend — so it goes beyond a proof of concept.  

----

## 🔑 Highlights

- **AI content generation**: Produces tweets that are varied, natural, and theme-aware  
- **Themes and subthemes**: Organises posts into 4–5 themes with subthemes for balance and variety  
- **Configurable volume**: Default is 15 tweets per day, but you can change it in code or schedule  
- **Voice alignment**: Learns from your sample tweets to stay on-brand  
- **Prompting best practices**: Uses structured prompts with rules for variation, hashtags, and tone  
- **Stateless but progressive**: Each run is independent while cycling through themes  
- **Provider flexibility**: Works with Anthropic, OpenAI, DeepSeek, or any compatible model  


## 🧠 Prompting & AI Optimization

A key part of this project is the `constructPrompt` function. It shows how to guide an LLM to produce consistent, useful output:

- **Theme awareness**: Passes theme, subtheme, and description to the model  
- **Voice analysis**: Uses sample tweets to match tone, structure, and engagement style  
- **Content rules**: Forces correct tweet length and one hashtag per subtheme  
- **Variation control**: Encourages mixed formats (questions, tips, statements)  
- **Parsing-friendly output**: Tweets are returned in a clear format  

This demonstrates how **prompt design** can turn a basic model call into a controlled, reusable content engine.  


## 🏗️ AWS Architecture

- **AWS Lambda**: Serverless execution with scheduled triggers (every ~5 hours)  
- **DynamoDB**: Stores state and sample tweets  
- **Secrets Manager**: Keeps credentials secure  
- **EventBridge**: Automates scheduling  


## 🔧 Setup

### 1. Install dependencies
   ```bash
   npm install
```
### 2. Database Setup and add sample tweets
  ```bash
  node setup-dynamodb.js
```
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

## 🔄 Roadmap

- Recent Tweets Tracking: rack recently posted tweets to reduce repetition.
- Voice Analysis Engine: Add a voice analysis engine to detect tone and sentence patterns automatically.

## 🌟 Live Example

Currently running on [@ProyogiBaba](https://x.com/ProyogiBaba) demonstrating real-world thematic content generation with a custom model.

## 💬 Contact & Contributions

For feedback, questions, or contributions, reach out [here](https://github.com/3thousand30/simple_twitter_ai_agent/issues/1).

## 📝 License

MIT License - Feel free to adapt for your own projects.
