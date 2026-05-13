# LinkedIn Outreach Tracker

A Chrome extension for tracking LinkedIn cold outreach sequences with Google Sheets as the backend.

## What it does

- Detects when you're on a LinkedIn profile page and shows a small indicator
- Automatically captures the connection note you write when sending a connection request
- Tracks outreach sequence steps: Warmup → Connect → Chatting → CTA → Interest → Converted
- Auto-detects when a connection request is accepted (1st degree connection)
- Syncs all data to a Google Sheet you own, one row per contact

## Setup

### 1. Google Cloud credentials

You need a Google Cloud project with the Sheets API enabled and an OAuth 2.0 client ID for a Chrome Extension.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or use an existing one)
3. Enable the **Google Sheets API**
4. Create OAuth credentials: **OAuth client ID → Chrome Extension**
5. Copy the client ID into `manifest.json` under `oauth2.client_id`

Detailed steps: see [oauth-setup-instructions.md](oauth-setup-instructions.md)

### 2. Install the extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select this folder
4. Pin the extension to your toolbar

### 3. Connect your Google Sheet

1. Create a new Google Sheet (blank)
2. Click the extension icon on any LinkedIn profile page
3. Paste the spreadsheet ID (from the sheet's URL) and click **Save**
4. The extension will create the column headers automatically on first use

## Usage

Navigate to any LinkedIn profile. The extension popup shows the contact's current outreach status. Check off sequence steps as you complete them. Connection notes are captured automatically when you send a connection request with a note.

## Project structure

```
manifest.json        Chrome extension manifest (MV3)
content.js           Content script — runs on LinkedIn pages
background.js        Service worker — handles OAuth token refresh
popup.html/js        Extension popup UI
js/
  config.js          Column definitions and sequence steps
  sheets-api.js      Google Sheets API v4 wrapper
  auth-manager.js    OAuth flow via chrome.identity
  contact-manager.js Contact read/write logic
  ui-manager.js      Popup UI updates
  utils.js           Shared helpers
  profile-extractor.js  LinkedIn DOM scraping
```

## Notes

- `manifest.json` is not committed with a real client ID — add yours locally before loading the extension
- The extension uses `event.composedPath()` to detect send-button clicks inside LinkedIn's shadow DOM
- Data is stored exclusively in your Google Sheet; nothing is sent to any third-party server
