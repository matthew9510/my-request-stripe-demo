'use strict';

module.exports = {
  // App name
  appName: 'Rocket Rides',

  // Public domain of Rocket Rides
  publicDomain: 'http://localhost:3000',

  // Server port
  port: 3000,

  // Secret for cookie sessions
  secret: 'YOUR_SECRET',

  // Configuration for Stripe
  // API Keys: https://dashboard.stripe.com/account/apikeys
  // Connect Settings: https://dashboard.stripe.com/account/applications/settings
  stripe: {
    // secretKey: 'sk_test_Y2Zm1w5cMdrXWT5mQ8lKbjrD00N97nDCUY',
    secretKey: process.env['SECRET_KEY'],
    // publishableKey: 'pk_test_fWwnwk8WZXnwNGVXYyFkl0nm00gaMEQae4',
    publishableKey: process.env['PUBLISHABLE_KEY'],

    // clientId: 'ca_Fnw3KdlX9je60xTKxZOfdMSWq9hcv2ZE',
    clientId: process.env['CLIENT_ID'],
    // authorizeUri: 'https://connect.stripe.com/express/oauth/authorize',
    authorizeUri: process.env['AUTHORIZE_URI'],
    // tokenUri: 'https://connect.stripe.com/oauth/token'
    tokenUri: process.env['TOKEN_URI']
  },

  // Configuration for MongoDB
  // mongoUri: 'mongodb://localhost/rocketrides',
  // mongoUri: 'mongodb+srv://admin:admin@rocketrides-cluster0-fskiz.mongodb.net/test?retryWrites=true&w=majority',
  mongoUri: process.env['MONGO_URI'],

  // Configuration for Google Cloud (only useful if you want to deploy to GCP)
  gcloud: {
    projectId: 'YOUR_PROJECT_ID'
  }
};
