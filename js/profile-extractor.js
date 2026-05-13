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
          // Page-wide scan for degree-badge leaves, with sidebar/nav exclusion.
          // The profile's own badge always sits at the very top of the document
          // (in the topcard); the right rail's "More profiles" badges sit lower.
          // So: collect all visible candidates, filter sidebars, take topmost.
          let isFirstDegreeConnection = false
          let degreeMatch = null
          const candidates = []

          for (const el of document.querySelectorAll("*")) {
            // Allow up to 2 children — catches <span>1<sup>st</sup></span>
            // without matching large containers.
            if (el.children.length > 2) continue
            const t = (el.textContent || "").trim().replace(/^[·•·]\s*/, "").trim()
            if (!/^(1st|2nd|3rd)$/i.test(t)) continue
            // Exclude sidebars, nav, related-profiles cards
            if (el.closest("aside, nav, [role='complementary'], [role='navigation']")) continue
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) continue // skip hidden duplicates
            candidates.push({ text: t, y: r.top + window.scrollY })
          }

          candidates.sort((a, b) => a.y - b.y)
          if (candidates.length) degreeMatch = candidates[0].text

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
