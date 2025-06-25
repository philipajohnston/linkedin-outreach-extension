# LinkedIn Outreach Tracker - Setup Instructions

## Step 1: Load Extension (Development Mode)

1. **Remove the "key" and "oauth2" fields** from manifest.json (they're not needed for development)
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable "Developer mode"** (toggle in top right)
4. **Click "Load unpacked"** and select your extension folder
5. **Note the Extension ID** that appears (you'll need this for OAuth setup)

## Step 2: Set up Google Cloud OAuth2

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. **Enable Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search "Google Sheets API" and enable it

4. **Create OAuth2 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Chrome Extension"
   - Enter your Extension ID from Step 1

5. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" user type
   - Fill required fields:
     - App name: "LinkedIn Outreach Tracker"
     - User support email: your email
   - Add scope: `https://www.googleapis.com/auth/spreadsheets`
   - Add your email as a test user

## Step 3: Update Extension with OAuth Client ID

Once you have your OAuth2 Client ID, update the manifest:

\`\`\`json
{
  "manifest_version": 3,
  "name": "LinkedIn Outreach Tracker",
  "version": "1.0.0",
  "description": "Track LinkedIn outreach sequences with Google Sheets integration",
  "permissions": ["activeTab", "storage", "scripting", "identity"],
  "host_permissions": ["https://www.linkedin.com/*", "https://linkedin.com/*", "https://sheets.googleapis.com/*"],
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["https://www.googleapis.com/auth/spreadsheets"]
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/*", "https://linkedin.com/*"],
      "js": ["content.js"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "LinkedIn Outreach Tracker"
  },
  "web_accessible_resources": [
    {
      "resources": ["popup.html", "popup.js"],
      "matches": ["https://www.linkedin.com/*", "https://linkedin.com/*"]
    }
  ]
}
\`\`\`

## Step 4: Test the Extension

1. **Reload the extension** in Chrome extensions page
2. **Go to a LinkedIn profile** (e.g., linkedin.com/in/someone)
3. **Click the extension icon**
4. **Click "Sign in with Google"**
5. **Grant permissions** when prompted
6. **Enter a Google Sheets ID** and test the connection

## Troubleshooting

- **"Failed to load extension"**: Remove `key` and `oauth2` fields for initial loading
- **"OAuth error"**: Make sure your OAuth2 client ID is correct and consent screen is configured
- **"API not enabled"**: Enable Google Sheets API in Google Cloud Console
- **"Permission denied"**: Add your email as a test user in OAuth consent screen
