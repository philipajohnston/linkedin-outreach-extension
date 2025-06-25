chrome.runtime.onInstalled.addListener(() => {
  console.log("LinkedIn Outreach Tracker installed successfully")
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request)

  if (request.action === "openPopup") {
    console.log("Popup open requested from content script")
  }

  sendResponse({ success: true })
})

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked on tab:", tab.url)
})

// Handle any extension errors
chrome.runtime.onStartup.addListener(() => {
  console.log("LinkedIn Outreach Tracker startup")
})
