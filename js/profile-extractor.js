// LinkedIn profile data extraction
export class ProfileExtractor {
  static async extractProfileData() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // --- Name ---
          let name = ""
          const nameSelectors = [
            'section[componentkey*="Topcard"] h2',
            'section[componentkey*="RvgTopcard"] h2',
            '[data-sdui-component*="profileTopCardSection"] h2',
            "h1.text-heading-xlarge",
            "main h1",
            "section h1",
          ]
          for (const sel of nameSelectors) {
            try {
              const el = document.querySelector(sel)
              if (el && el.textContent.trim()) { name = el.textContent.trim(); break }
            } catch (_) {}
          }

          // --- 1st degree connection ---
          // Search topcard first; fall back to whole page if not found.
          // LinkedIn uses <span> (not <p>) for the degree badge in current SDUI.
          let isFirstDegreeConnection = false
          const searchRoot =
            document.querySelector('[componentkey*="Topcard"]') ||
            document.querySelector('[componentkey*="profileTopCard"]') ||
            document.querySelector('[data-sdui-component*="profileTopCardSection"]') ||
            document.body

          let lastDegree = null
          for (const el of searchRoot.querySelectorAll("*")) {
            // Skip layout containers — degree badge is always a leaf/near-leaf element
            if (el.children.length > 3) continue
            const t = (el.textContent || "").trim()
            // Match "· 1st", "1st", "· 2nd", etc. (· may be U+00B7 or regular middle dot)
            if (/^[·•·]?\s*(1st|2nd|3rd)\s*$/i.test(t)) lastDegree = t
            // Don't break — LinkedIn renders a hidden duplicate; last match is the visible one
          }
          if (lastDegree) isFirstDegreeConnection = /1st/i.test(lastDegree)

          // --- Role & Company from current experience ---
          let role = ""
          let company = ""

          let expSection = null
          const expSelectors = [
            'section[componentkey*="ExperienceTopLevelSection"]',
            '[componentkey*="ExperienceTopLevelSection"]',
            '[componentkey*="Experience"]',
            "#experience",
          ]
          for (const sel of expSelectors) {
            try {
              const el = document.querySelector(sel)
              if (el) { expSection = el.closest("section") || el; break }
            } catch (_) {}
          }
          if (!expSection) {
            for (const sec of document.querySelectorAll("section")) {
              const h2 = sec.querySelector("h2")
              if (h2 && h2.textContent.toLowerCase().includes("experience")) { expSection = sec; break }
            }
          }

          if (expSection) {
            // Current LinkedIn SDUI: entity-collection-item divs with <p> elements
            const entityItems = expSection.querySelectorAll('[componentkey*="entity-collection-item"]')
            for (const item of entityItems) {
              if (!(item.innerText || "").toLowerCase().includes("present")) continue
              let r = "", c = ""
              for (const p of item.querySelectorAll("p")) {
                const t = (p.textContent || "").trim()
                if (!t || t.length < 2 || /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d)/i.test(t)) continue
                if (!r && !t.includes("·")) r = t
                else if (!c && t.includes("·")) c = t.split("·")[0].trim()
              }
              if (r && c) { role = r; company = c; break }
            }

            // Fallback: legacy list-item structure
            if (!role || !company) {
              for (const li of expSection.querySelectorAll("li")) {
                if (!(li.innerText || "").toLowerCase().includes("present")) continue
                const spans = Array.from(li.querySelectorAll('span[aria-hidden="true"]'))
                  .map((s) => s.textContent.trim())
                  .filter((t) => t && t.length > 1 && !/(\d{4}|present|·|full-time|part-time|contract|yrs|mos)/i.test(t))
                if (spans.length >= 2) {
                  role = spans[0]
                  company = spans[1].split("·")[0].replace(/\s*(Full-time|Part-time|Contract)\s*$/i, "").trim()
                  break
                }
                if (spans.length === 1) { role = spans[0]; break }
              }
            }
          }

          return {
            name: name || "Unknown",
            role,
            company,
            profileUrl: window.location.href.split("?")[0].split("#")[0],
            isFirstDegreeConnection,
          }
        },
      })
      return results[0].result
    } catch (error) {
      console.error("Profile extraction error:", error)
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        return {
          name: "Profile User", role: "", company: "",
          profileUrl: tab?.url?.split("?")[0].split("#")[0] || "Unknown",
          isFirstDegreeConnection: false,
        }
      } catch (_) {
        return { name: "Profile User", role: "", company: "", profileUrl: "Unknown", isFirstDegreeConnection: false }
      }
    }
  }
}
