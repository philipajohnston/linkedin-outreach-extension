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
          // Scope the search tightly to the topcard. A page-wide scan picks up
          // "1st" from mutual connections, feed snippets, dates, etc.
          let isFirstDegreeConnection = false
          let degreeMatch = null

          // Locate the topcard by walking up from the profile name h1.
          // More reliable than componentkey/data-sdui-* selectors which churn
          // between LinkedIn SDUI revisions.
          const nameEl = document.querySelector("main h1") || document.querySelector("section h1")
          let topcard = null
          if (nameEl) {
            topcard =
              nameEl.closest('[componentkey*="Topcard"]') ||
              nameEl.closest('[componentkey*="profileTopCard"]') ||
              nameEl.closest("section")
          }
          topcard =
            topcard ||
            document.querySelector('[componentkey*="Topcard"]') ||
            document.querySelector("main") ||
            document.body

          // Strategy 1: aria-label — most reliable when present.
          // LinkedIn labels the degree badge like "...• 1st degree connection..."
          for (const el of topcard.querySelectorAll("[aria-label]")) {
            const aria = el.getAttribute("aria-label") || ""
            const m = aria.match(/\b(1st|2nd|3rd)\s+degree\b/i)
            if (m) { degreeMatch = m[1]; break }
          }

          // Strategy 2: leaf-text scan for the visible "· 1st" badge.
          if (!degreeMatch) {
            for (const el of topcard.querySelectorAll("span, p")) {
              if (el.children.length > 0) continue // leaves only
              const t = (el.textContent || "").trim().replace(/^[·•·]\s*/, "").trim()
              if (/^(1st|2nd|3rd)$/i.test(t)) { degreeMatch = t; break }
            }
          }

          if (degreeMatch) isFirstDegreeConnection = /1st/i.test(degreeMatch)

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
