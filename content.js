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
      // Find the button that was clicked - expanded selectors for current LinkedIn
      const sendButton = event.target.closest(
        'button[aria-label*="Send invitation"], button[aria-label*="Send now"], button[aria-label*="Send"], button[aria-label*="send"]'
      )
      
      // Also check if this is a send button by its text content
      const clickedButton = event.target.closest('button')
      const isSendButton = sendButton || (clickedButton && 
        (clickedButton.textContent.toLowerCase().includes('send') || 
         clickedButton.textContent.toLowerCase().includes('connect')))
      
      if (!isSendButton) return

      console.log("LinkedIn Tracker: Potential send/connect button clicked.")

      // Find the modal - try multiple selectors for current LinkedIn
      const modal = event.target.closest('div[role="dialog"], .artdeco-modal, .send-invite, [data-test-modal]')
      if (!modal) {
        console.log("LinkedIn Tracker: Could not find parent modal for send button.")
        return
      }

      // Find the message textarea within that modal - expanded selectors
      const messageTextarea = modal.querySelector(
        'textarea[name="message"], textarea#custom-message, textarea.connect-button-send-invite__custom-message, textarea[id*="message"], textarea'
      )
      const noteText = messageTextarea ? messageTextarea.value.trim() : ""

      if (noteText) {
        console.log("LinkedIn Tracker: Found connection note:", noteText)
        const profileUrl = window.location.href.split("?")[0].split("#")[0]
        const storageKey = `connectionNote_${profileUrl}`

        try {
          await chrome.storage.local.set({ [storageKey]: noteText })
          console.log(`LinkedIn Tracker: Note saved to temporary storage for ${profileUrl}`)
        } catch (error) {
          console.error("LinkedIn Tracker: Error saving note to storage:", error)
        }
      } else {
        console.log("LinkedIn Tracker: No note text found in modal textarea.")
      }
    })
  }
}

// Initialize the detector
console.log("LinkedIn Outreach Tracker: Content script loaded")
new LinkedInProfileDetector()
