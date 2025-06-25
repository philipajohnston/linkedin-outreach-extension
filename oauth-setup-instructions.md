# OAuth2 Setup Instructions

## Step 1: Create OAuth2 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client IDs"
5. Choose "Chrome Extension" as the application type
6. Add your extension ID (you'll get this after loading the extension)

## Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required information:
   - App name: "LinkedIn Outreach Tracker"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes: `https://www.googleapis.com/auth/spreadsheets`
5. Add test users (your email) if in testing mode

## Step 3: Enable Google Sheets API

1. Go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"

## Step 4: Update Extension

1. Replace `YOUR_OAUTH_CLIENT_ID` in manifest.json with your actual client ID
2. Replace `YOUR_EXTENSION_KEY_HERE` with a consistent key for your extension
3. Load the extension in Chrome to get the extension ID
4. Add the extension ID to your OAuth2 client configuration

## Step 5: Test

1. Load the updated extension
2. Click "Sign in with Google"
3. Grant permissions to access Google Sheets
4. Test creating and updating spreadsheets
