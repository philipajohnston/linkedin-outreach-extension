// js/popup.js

document.addEventListener("DOMContentLoaded", () => {
  const checkPageButton = document.getElementById("checkPage")

  checkPageButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      var currentTab = tabs[0]
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: scrapeData,
      })
    })
  })
})

function scrapeData() {
  // Example scraping logic (replace with your actual scraping code)
  const title = document.title
  const url = window.location.href
  const description = document.querySelector('meta[name="description"]')?.getAttribute("content") || ""

  // Send the scraped data back to the popup
  chrome.runtime.sendMessage({
    title: title,
    url: url,
    description: description,
  })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.title || request.url || request.description) {
    document.getElementById("title").textContent = "Title: " + request.title
    document.getElementById("url").textContent = "URL: " + request.url
    document.getElementById("description").textContent = "Description: " + request.description
  }
})
