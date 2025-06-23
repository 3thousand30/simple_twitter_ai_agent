const AWS = require('aws-sdk');

// Configure AWS - replace with your credentials or use environment variables
AWS.config.update({
  region: 'eu-central-1' // Change to your preferred region
});

const dynamoDB = new AWS.DynamoDB();
const documentClient = new AWS.DynamoDB.DocumentClient();

// Create tables function
async function createTables() {
  // Create state table
  const stateTableParams = {
    TableName: 'TwitterBotState',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  // Create sample tweets table
  const sampleTweetsTableParams = {
    TableName: 'TwitterBotSampleTweets',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    console.log('Creating TwitterBotState table...');
    await dynamoDB.createTable(stateTableParams).promise();
    console.log('TwitterBotState table created successfully!');

    console.log('Creating TwitterBotSampleTweets table...');
    await dynamoDB.createTable(sampleTweetsTableParams).promise();
    console.log('TwitterBotSampleTweets table created successfully!');

    // Initialize state
    // Important: The initial state need to be updated with your actual themes and subthemes.
    console.log('Initializing state...');
    await documentClient.put({
      TableName: 'TwitterBotState',
      Item: {
        id: 'current_state',
        mainTheme: 'Theme1',
        subTheme: 'Subtheme1',
        tweetsPostedToday: 0,
        currentSubThemeCount: 0,
        currentDay: new Date().toDateString(),
        lastUpdated: new Date().toISOString()
      }
    }).promise();
    console.log('State initialized!');

    console.log('DynamoDB setup completed successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

// Function to add sample tweets
async function addSampleTweet(text) {
  const id = `tweet_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  try {
    await documentClient.put({
      TableName: 'TwitterBotSampleTweets',
      Item: {
        id,
        text,
        createdAt: new Date().toISOString()
      }
    }).promise();
    console.log(`Added sample tweet: ${text}`);
  } catch (error) {
    console.error('Error adding sample tweet:', error);
  }
}

// Example usage:
async function main() {
  // First create the tables
  await createTables();
  
  // Wait for tables to be active
  console.log('Waiting for tables to be active...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Then add some sample tweets. You can add as much as you want but keep token limits in mind.
  // Important: Needs to updated with actual sample tweets relevant to your themes.
  const sampleTweets = [
    "Sample tweet content. #Subtheme1",
    "Sample tweet content. #Subtheme2",
    "Sample tweet content. #Subtheme3",
    "Sample tweet content. #Subtheme4",
    "Sample tweet content. #Subtheme5",
  ];
  
  for (const tweet of sampleTweets) {
    await addSampleTweet(tweet);
  }
  
  console.log('Setup complete!');
}

main();