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
    
    let pendingNote = ""
    let attachedTextareas = new WeakSet()
    
    // Poll for the invite textarea directly - more reliable than modal detection
    // The textarea has id="custom-message" or name="message"
    const checkForTextarea = () => {
      const textarea = document.querySelector('textarea#custom-message, textarea[name="message"]')
      
      if (textarea && !attachedTextareas.has(textarea)) {
        attachedTextareas.add(textarea)
        console.log("[v0] Found invite textarea:", textarea.id, textarea.name)
        
        // Capture input
        textarea.addEventListener("input", () => {
          pendingNote = textarea.value
          console.log("[v0] Note updated:", pendingNote.substring(0, 30))
        })
        
        // Capture initial value
        if (textarea.value) {
          pendingNote = textarea.value
        }
        
        // Find and attach to the send button in the same dialog
        const dialog = textarea.closest('[role="dialog"], .artdeco-modal')
        if (dialog) {
          console.log("[v0] Found parent dialog")
          const buttons = dialog.querySelectorAll('button')
          buttons.forEach(btn => {
            const text = (btn.textContent || '').trim().toLowerCase()
            if (text === 'send' || text === 'send now') {
              console.log("[v0] Attaching to send button:", text)
              btn.addEventListener("click", () => saveNote(textarea), true)
            }
          })
        }
      }
    }
    
    const saveNote = async (textarea) => {
      console.log("[v0] saveNote called")
      let noteText = textarea ? textarea.value.trim() : pendingNote
      
      if (!noteText) {
        console.log("[v0] No note to save")
        return
      }
      
      const profileUrl = window.location.href.split("?")[0].split("#")[0]
      const storageKey = `connectionNote_${profileUrl}`
      
      console.log("[v0] Saving note:", noteText.substring(0, 30), "to", storageKey)
      
      try {
        await chrome.storage.local.set({ [storageKey]: noteText })
        console.log("[v0] Note saved!")
        pendingNote = ""
      } catch (error) {
        console.error("[v0] Save error:", error)
      }
    }
    
    // Check every 500ms for the textarea
    setInterval(checkForTextarea, 500)
    
    // Also use MutationObserver as a backup
    const observer = new MutationObserver(checkForTextarea)
    observer.observe(document.body, { childList: true, subtree: true })
    
    console.log("[v0] Polling and MutationObserver started")
  }
}

// Initialize the detector
console.log("LinkedIn Outreach Tracker: Content script loaded")
new LinkedInProfileDetector()
