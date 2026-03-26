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
    console.log("[v0] listenForConnectionNotes initialized")
    
    // Store the note value whenever it changes - this is our primary capture method
    let pendingNote = ""
    
    // Capture note value on ANY input to a textarea (use capture phase)
    document.addEventListener("input", (event) => {
      const target = event.target
      if (target.tagName !== 'TEXTAREA') return
      
      // Log ALL textareas to see what's available
      console.log("[v0] Textarea input detected - id:", target.id, "name:", target.name, "class:", target.className)
      
      // Check if this looks like the invite note textarea
      const isInviteTextarea = (
        target.id === 'custom-message' ||
        target.name === 'message' ||
        (target.className && target.className.includes('connect-button-send-invite'))
      )
      
      if (isInviteTextarea) {
        pendingNote = target.value
        console.log("[v0] Captured invite note:", pendingNote.substring(0, 50))
      }
    }, true) // Use capture phase to get events before they're consumed
    
    // Also listen for any button click that might be a send action
    document.addEventListener("click", async (event) => {
      const button = event.target.closest('button')
      if (!button) return
      
      const buttonText = (button.textContent || '').trim().toLowerCase()
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase()
      
      console.log("[v0] Button clicked - text:", buttonText, "aria:", ariaLabel)
      
      // Check if this is the send button
      const isSendButton = (
        buttonText === 'send' ||
        buttonText === 'send now' ||
        buttonText.startsWith('send invitation') ||
        ariaLabel.includes('send invitation') ||
        ariaLabel.includes('send now')
      )
      
      if (!isSendButton) return
      
      console.log("[v0] Send button detected!")
      
      // Try to grab textarea value directly first (in case input event missed it)
      let noteText = pendingNote
      const textarea = document.querySelector('textarea#custom-message, textarea[name="message"]')
      if (textarea && textarea.value) {
        noteText = textarea.value.trim()
        console.log("[v0] Got note from textarea directly:", noteText.substring(0, 50))
      }
      
      if (!noteText) {
        console.log("[v0] No note text to save")
        return
      }
      
      // Save to storage
      const profileUrl = window.location.href.split("?")[0].split("#")[0]
      const storageKey = `connectionNote_${profileUrl}`
      
      console.log("[v0] Saving note to storage key:", storageKey)
      
      try {
        await chrome.storage.local.set({ [storageKey]: noteText })
        console.log("[v0] Note saved successfully!")
        pendingNote = "" // Clear after saving
      } catch (error) {
        console.error("[v0] Error saving note:", error)
      }
    }, true) // Use capture phase
  }
}

// Initialize the detector
console.log("LinkedIn Outreach Tracker: Content script loaded")
new LinkedInProfileDetector()
