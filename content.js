class LinkedInProfileDetector {
  constructor() {
    this.indicatorAdded = false
    this.init()
  }

  init() {
    // Wait for initial page load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => this.checkAndAddIndicator(), 1000)
      })
    } else {
      setTimeout(() => this.checkAndAddIndicator(), 1000)
    }

    // Listen for navigation changes (LinkedIn is a SPA)
    this.observeUrlChanges()
    // Listen for connection note submissions
    this.listenForConnectionNotes()
  }

  isProfilePage() {
    const url = window.location.href
    const pathname = window.location.pathname

    return (
      url.includes("/in/") &&
      pathname.match(/^\/in\/[^/]+\/?$/) &&
      !url.includes("/recent-activity") &&
      !url.includes("/detail/") &&
      !url.includes("/overlay/")
    )
  }

  checkAndAddIndicator() {
    if (this.isProfilePage() && !this.indicatorAdded) {
      this.addProfileIndicator()
    } else if (!this.isProfilePage() && this.indicatorAdded) {
      this.removeProfileIndicator()
    }
  }

  addProfileIndicator() {
    // Remove existing indicator
    this.removeProfileIndicator()

    // Create indicator
    const indicator = document.createElement("div")
    indicator.id = "linkedin-tracker-indicator"
    indicator.innerHTML = "📊"
    indicator.title = "LinkedIn Outreach Tracker - Click extension icon to track this profile"
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      background: #0a66c2;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      cursor: pointer;
      transition: transform 0.2s;
      border: 2px solid white;
    `

    indicator.addEventListener("mouseenter", () => {
      indicator.style.transform = "scale(1.1)"
      indicator.style.background = "#004182"
    })

    indicator.addEventListener("mouseleave", () => {
      indicator.style.transform = "scale(1)"
      indicator.style.background = "#0a66c2"
    })

    document.body.appendChild(indicator)
    this.indicatorAdded = true

    console.log("LinkedIn Outreach Tracker: Profile detected and indicator added")
  }

  removeProfileIndicator() {
    const indicator = document.getElementById("linkedin-tracker-indicator")
    if (indicator) {
      indicator.remove()
      this.indicatorAdded = false
    }
  }

  observeUrlChanges() {
    let currentUrl = window.location.href

    // Use both MutationObserver and popstate for better detection
    const checkUrlChange = () => {
      if (currentUrl !== window.location.href) {
        currentUrl = window.location.href
        console.log("LinkedIn Outreach Tracker: URL changed to", currentUrl)

        // Delay to allow LinkedIn to render
        setTimeout(() => this.checkAndAddIndicator(), 1500)
      }
    }

    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", checkUrlChange)

    // Listen for DOM changes (SPA navigation)
    const observer = new MutationObserver(() => {
      checkUrlChange()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Also check periodically as a fallback
    setInterval(checkUrlChange, 2000)
  }

  listenForConnectionNotes() {
    const chrome = window.chrome
    
    document.body.addEventListener("click", async (event) => {
      // Find the button that was clicked
      const clickedButton = event.target.closest('button')
      if (!clickedButton) return
      
      // Check if this is a send/connect button by multiple criteria
      const ariaLabel = (clickedButton.getAttribute('aria-label') || '').toLowerCase()
      const buttonText = (clickedButton.textContent || '').toLowerCase().trim()
      
      const isSendButton = 
        ariaLabel.includes('send invitation') ||
        ariaLabel.includes('send now') ||
        (ariaLabel.includes('send') && !ariaLabel.includes('message')) ||
        buttonText === 'send' ||
        buttonText === 'send invitation' ||
        buttonText === 'send now'
      
      if (!isSendButton) return

      console.log("LinkedIn Tracker: Send button clicked, looking for connection note...")

      // Strategy 1: Find the send-invite modal specifically (most reliable)
      // LinkedIn uses data-test-modal-id="send-invite-modal" or aria-labelledby="send-invite-modal"
      let modal = document.querySelector(
        '[data-test-modal-id="send-invite-modal"], ' +
        '[aria-labelledby="send-invite-modal"], ' +
        'div[data-test-modal-container][data-test-modal-id="send-invite-modal"]'
      )
      
      // Strategy 2: Find modal by looking up from the clicked button
      if (!modal) {
        modal = event.target.closest(
          '[data-test-modal-id="send-invite-modal"], ' +
          'div[role="dialog"][aria-labelledby*="invite"], ' +
          'div[role="dialog"].artdeco-modal, ' +
          '.artdeco-modal-overlay'
        )
      }
      
      // Strategy 3: Find any open dialog that might contain the invite form
      if (!modal) {
        modal = document.querySelector(
          'div[role="dialog"]:not([aria-hidden="true"]), ' +
          '.artdeco-modal:not([aria-hidden="true"])'
        )
      }
      
      if (!modal) {
        console.log("LinkedIn Tracker: Could not find invite modal.")
        return
      }
      
      console.log("LinkedIn Tracker: Found modal, searching for textarea...")

      // Find the message textarea - prioritize specific selectors
      // From DOM: id="custom-message", name="message", class contains "connect-button-send-invite__custom-message"
      const textareaSelectors = [
        'textarea#custom-message',
        'textarea[name="message"]',
        'textarea.connect-button-send-invite__custom-message',
        'textarea[class*="connect-button-send-invite"]',
        'textarea[class*="custom-message"]',
        'textarea[id*="custom-message"]',
        'textarea[placeholder*="We know each other"]',
        'textarea'  // Last resort: any textarea in the modal
      ]
      
      let messageTextarea = null
      for (const selector of textareaSelectors) {
        try {
          messageTextarea = modal.querySelector(selector)
          if (messageTextarea && messageTextarea.value !== undefined) {
            console.log("LinkedIn Tracker: Found textarea with selector:", selector)
            break
          }
        } catch (e) {
          // Skip invalid selectors
        }
      }
      
      // Also try finding textarea in the entire document if modal search failed
      // (sometimes the modal structure is tricky)
      if (!messageTextarea) {
        for (const selector of textareaSelectors.slice(0, -1)) { // Skip generic 'textarea'
          try {
            messageTextarea = document.querySelector(selector)
            if (messageTextarea && messageTextarea.value !== undefined) {
              console.log("LinkedIn Tracker: Found textarea in document with selector:", selector)
              break
            }
          } catch (e) {}
        }
      }
      
      const noteText = messageTextarea ? messageTextarea.value.trim() : ""

      if (noteText) {
        console.log("LinkedIn Tracker: Found connection note:", noteText.substring(0, 50) + "...")
        const profileUrl = window.location.href.split("?")[0].split("#")[0]
        const storageKey = `connectionNote_${profileUrl}`

        try {
          await chrome.storage.local.set({ [storageKey]: noteText })
          console.log(`LinkedIn Tracker: Note saved to temporary storage for ${profileUrl}`)
        } catch (error) {
          console.error("LinkedIn Tracker: Error saving note to storage:", error)
        }
      } else {
        console.log("LinkedIn Tracker: No note text found in textarea (may be empty or not present).")
      }
    })
  }
}

// Initialize the detector
console.log("LinkedIn Outreach Tracker: Content script loaded")
new LinkedInProfileDetector()
