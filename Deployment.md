# Deployment Instructions

## Prerequisites

1. **AWS CLI** installed and configured with your credentials
2. **AWS SAM CLI** installed
3. Node.js 18.x or later

## Setup Steps

### 1. Install AWS SAM CLI
```bash
# macOS
brew install aws-sam-cli

# Windows (using Chocolatey)
choco install aws-sam-cli

# Or download from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
```

### 2. Configure AWS Credentials
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and preferred region
```

### 3. Set up Secrets Manager
Create your secrets in AWS Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name "twitter-bot-secrets" \
  --description "API credentials for Twitter bot" \
  --secret-string '{
    "twitter_api_key": "your_twitter_api_key",
    "twitter_api_secret": "your_twitter_api_secret",
    "twitter_access_token": "your_twitter_access_token",
    "twitter_access_token_secret": "your_twitter_access_token_secret",
    "ai_provider_api_key": "your_ai_api_key"
  }'
```

Or use the AWS Console to create the secret manually.

### 4. Deploy the Application

```bash
# Build the application
sam build

# Deploy with guided prompts (first time)
sam deploy --guided

# For subsequent deployments
sam deploy
```

### 5. Initialize Database and Sample Tweets

After deployment, run the setup script:

```bash
# Update your themes in setup-dynamodb.js first
node setup-dynamodb.js
```

## Configuration Options

### Custom Schedule
To change how often the bot runs, modify the `ScheduleRate` parameter:

```bash
sam deploy --parameter-overrides ScheduleRate="rate(4 hours)"
```

### Custom Secret Name
```bash
sam deploy --parameter-overrides SecretName="my-custom-secret-name"
```

## Monitoring

### View Logs
```bash
sam logs -n TwitterBotFunction --tail
```

### View CloudWatch Logs in AWS Console
Navigate to CloudWatch > Log Groups > `/aws/lambda/twitter-ai-agent`

## Cleanup

To remove all resources:
```bash
sam delete
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure your AWS user has permissions for Lambda, DynamoDB, CloudWatch, and Secrets Manager

2. **Secret Not Found**: Verify the secret name matches what you created in Secrets Manager

3. **DynamoDB Errors**: Check that tables are created and accessible in your region

4. **Twitter API Errors**: Verify your Twitter API credentials and permissions

### Manual Testing
```bash
# Test the function locally
sam local invoke TwitterBotFunction

# Test with custom event
sam local invoke TwitterBotFunction -e events/test-event.json
```