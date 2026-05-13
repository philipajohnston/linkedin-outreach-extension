class LinkedInProfileDetector {
  constructor() {
    this.indicatorAdded = false
    this.init()
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(() => this.checkAndAddIndicator(), 1000))
    } else {
      setTimeout(() => this.checkAndAddIndicator(), 1000)
    }
    this.observeUrlChanges()
    this.listenForConnectionNotes()
  }

  isProfilePage() {
    const url = window.location.href
    return (
      url.includes("/in/") &&
      window.location.pathname.match(/^\/in\/[^/]+\/?$/) &&
      !url.includes("/recent-activity") &&
      !url.includes("/detail/") &&
      !url.includes("/overlay/")
    )
  }

  checkAndAddIndicator() {
    if (this.isProfilePage() && !this.indicatorAdded) this.addProfileIndicator()
    else if (!this.isProfilePage() && this.indicatorAdded) this.removeProfileIndicator()
  }

  addProfileIndicator() {
    this.removeProfileIndicator()
    const indicator = document.createElement("div")
    indicator.id = "linkedin-tracker-indicator"
    indicator.innerHTML = "📊"
    indicator.title = "LinkedIn Outreach Tracker - Click extension icon to track this profile"
    indicator.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      width: 40px; height: 40px;
      background: #0a66c2; color: white;
      border-radius: 50%; display: flex;
      align-items: center; justify-content: center;
      font-size: 18px; z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      cursor: pointer; transition: transform 0.2s;
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
  }

  removeProfileIndicator() {
    const el = document.getElementById("linkedin-tracker-indicator")
    if (el) { el.remove(); this.indicatorAdded = false }
  }

  observeUrlChanges() {
    let currentUrl = window.location.href
    const checkUrlChange = () => {
      if (currentUrl !== window.location.href) {
        currentUrl = window.location.href
        setTimeout(() => this.checkAndAddIndicator(), 1500)
      }
    }
    window.addEventListener("popstate", checkUrlChange)
    // Poll instead of MutationObserver to avoid firing on every DOM mutation
    setInterval(checkUrlChange, 1500)
  }

  listenForConnectionNotes() {
    // LinkedIn renders the invite modal inside shadow DOM, so we use
    // event.composedPath() to traverse across shadow boundaries.
    document.addEventListener("click", async (e) => {
      const path = e.composedPath ? e.composedPath() : []
      if (!path.length) return

      let sendEl = null
      let textarea = null

      for (const el of path) {
        if (!el || !el.tagName) continue
        const tag = el.tagName.toLowerCase()
        const role = el.getAttribute?.("role") || ""

        if (!sendEl && (tag === "button" || role === "button")) {
          const text = (el.textContent || "").trim()
          const aria = el.getAttribute?.("aria-label") || ""
          if (/^send(\s+(now|invitation|invite|inmail))?$/i.test(text) ||
              /send.*(invitation|now|invite)/i.test(aria)) {
            sendEl = el
          }
        }

        if (!textarea && el.querySelector) {
          const ta = el.querySelector("textarea")
          if (ta && ta.value && ta.value.trim()) textarea = ta
        }
      }

      if (!sendEl) return

      // Fallback: any visible textarea with content on the page
      if (!textarea) {
        for (const ta of document.querySelectorAll("textarea")) {
          const r = ta.getBoundingClientRect()
          if (r.width > 0 && r.height > 0 && ta.value && ta.value.trim()) {
            textarea = ta
            break
          }
        }
      }

      const noteText = textarea && textarea.value ? textarea.value.trim() : ""
      if (!noteText) return

      const profileUrl = window.location.href.split("?")[0].split("#")[0]
      try {
        await chrome.storage.local.set({ [`connectionNote_${profileUrl}`]: noteText })
        console.log("[OutreachTracker] Connection note saved:", noteText.substring(0, 50))
      } catch (err) {
        console.error("[OutreachTracker] Failed to save connection note:", err)
      }
    }, true)
  }
}

new LinkedInProfileDetector()
