// LinkedIn profile data extraction

const chrome = window.chrome // Declare the chrome variable

export class ProfileExtractor {
  static async extractProfileData() {
    try {
      // Access chrome globally as it's available in extension contexts
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          console.log("Starting profile extraction with connection status detection...")

          // Extract name - updated selectors for current LinkedIn DOM
          // Note: LinkedIn's current SDUI layout uses h2 for profile names, not h1
          const nameSelectors = [
            // Current LinkedIn SDUI layout - h2 inside RvgTopcard section
            'section[componentkey*="RvgTopcard"] h2',
            '[componentkey*="RvgTopcard"] h2',
            'section[componentkey*="Topcard"] h2',
            // Profile page main area with h2
            '[data-sdui-screen*="profile.Profile"] section h2',
            'main[data-sdui-screen*="Profile"] section h2',
            // Legacy h1 selectors (older LinkedIn versions)
            "h1.text-heading-xlarge",
            ".pv-text-details__left-panel h1",
            'h1[data-anonymize="person-name"]',
            "main section h1",
            ".pv-top-card--list h1",
            "h1[slot='title']",
            ".artdeco-entity-lockup__title h1",
            "section.artdeco-card h1",
            ".scaffold-layout__main h1",
            "h1.inline",
          ]
          let name = ""
          for (const selector of nameSelectors) {
            try {
              const element = document.querySelector(selector)
              if (element && element.textContent.trim()) {
                name = element.textContent.trim()
                console.log("Found name with selector:", selector, "Name:", name)
                break
              }
            } catch (e) {
              // Skip invalid selectors
            }
          }
          
          // Fallback: find h2 in the main profile area first (current LinkedIn layout)
          if (!name) {
            // Try h2 in the first section within main (profile topcard area)
            const profileMain = document.querySelector('main[data-sdui-screen*="Profile"], div[data-sdui-screen*="Profile"]')
            if (profileMain) {
              const firstSectionH2 = profileMain.querySelector('section:first-of-type h2, section h2')
              if (firstSectionH2 && firstSectionH2.textContent.trim()) {
                name = firstSectionH2.textContent.trim()
                console.log("Found name via profile main h2:", name)
              }
            }
          }
          
          // Secondary fallback: any h2 in the main content that looks like a name
          if (!name) {
            const mainH2 = document.querySelector("main section h2")
            if (mainH2 && mainH2.textContent.trim()) {
              const h2Text = mainH2.textContent.trim()
              // Basic validation: names typically don't contain certain patterns
              if (!h2Text.match(/experience|education|about|skills|activity|interests/i)) {
                name = h2Text
                console.log("Found name via fallback main h2:", name)
              }
            }
          }
          
          // Final fallback: h1 search
          if (!name) {
            const mainH1 = document.querySelector("main h1") || document.querySelector("section h1")
            if (mainH1 && mainH1.textContent.trim()) {
              name = mainH1.textContent.trim()
              console.log("Found name via fallback h1:", name)
            }
          }

          // Check connection status - look for "1st" degree indicator near the name
          // IMPORTANT: Only detect as 1st degree if we find EXACTLY "1st", not "2nd" or "3rd"
          let isFirstDegreeConnection = false

          try {
            console.log("Checking for 1st degree connection status...")

            // Strategy 1: Look for the degree badge right next to the name (current LinkedIn shows "Name · 1st" or "Name · 2nd")
            // The degree indicator appears as a small span near the h2 name element
            
            // Find the topcard/name section
            const topcardSection = document.querySelector(
              'section[componentkey*="RvgTopcard"], section[componentkey*="Topcard"], [data-sdui-screen*="Profile"] section:first-of-type'
            )
            
            if (topcardSection) {
              console.log("Found topcard section for connection degree detection")
              
              // Look for exact degree text - should be a small element with just "1st", "2nd", or "3rd"
              // First, find elements that contain ONLY the degree indicator
              const allSpans = topcardSection.querySelectorAll('span, div')
              
              for (const el of allSpans) {
                // Get direct text content (not including children's text)
                const directText = Array.from(el.childNodes)
                  .filter(node => node.nodeType === Node.TEXT_NODE)
                  .map(node => node.textContent.trim())
                  .join('')
                
                const fullText = el.textContent?.trim() || ''
                
                // Check for exact match or very short text containing degree
                // Must be specific: "1st" should match, but "21st" should not
                const isExact1st = directText === '1st' || fullText === '1st'
                const isExact2nd = directText === '2nd' || fullText === '2nd' 
                const isExact3rd = directText === '3rd' || fullText === '3rd'
                
                // Also check for "· 1st" pattern (with separator)
                const hasDegreeSeparator = fullText.match(/^·?\s*(1st|2nd|3rd)\s*$/)
                
                if (isExact1st || (hasDegreeSeparator && hasDegreeSeparator[1] === '1st')) {
                  // Validate it's a small UI element, not a large text block
                  if (fullText.length < 15) {
                    isFirstDegreeConnection = true
                    console.log("Found 1st degree connection - exact match:", fullText)
                    break
                  }
                }
                
                // If we find 2nd or 3rd, we know they're NOT a 1st degree connection
                if (isExact2nd || isExact3rd || (hasDegreeSeparator && hasDegreeSeparator[1] !== '1st')) {
                  console.log("Found non-1st degree indicator:", fullText)
                  isFirstDegreeConnection = false
                  break
                }
              }
            }
            
            // Strategy 2: Check for "Message" button without "Connect" button
            // 1st degree connections have Message button but no Connect button
            if (!isFirstDegreeConnection) {
              const connectButton = document.querySelector('button:not([disabled])')
              let hasConnectButton = false
              let hasMessageButton = false
              
              // Look for buttons in the profile action area
              const actionButtons = document.querySelectorAll('button, a[role="button"]')
              for (const btn of actionButtons) {
                const btnText = btn.textContent?.toLowerCase().trim() || ''
                const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || ''
                
                if (btnText.includes('connect') || ariaLabel.includes('connect')) {
                  // Make sure it's not "Connected" or "Pending"
                  if (!btnText.includes('connected') && !btnText.includes('pending')) {
                    hasConnectButton = true
                    console.log("Found Connect button - not 1st degree")
                  }
                }
                if (btnText === 'message' || ariaLabel.includes('message')) {
                  hasMessageButton = true
                }
              }
              
              // If there's a Connect button, they're definitely NOT 1st degree
              if (hasConnectButton) {
                isFirstDegreeConnection = false
                console.log("Connect button present - confirmed NOT 1st degree connection")
              }
            }
            
          } catch (error) {
            console.log("Error in connection degree detection (non-fatal):", error)
            isFirstDegreeConnection = false
          }

          console.log("Final connection status - Is 1st degree:", isFirstDegreeConnection)

          let role = ""
          let company = ""

          // Find Experience section - updated for current LinkedIn DOM
          let experienceSection = null
          
          // Try multiple approaches to find experience section
          const experienceSectionSelectors = [
            '#experience',
            'section[id="experience"]',
            'div[id="experience"]',
            '[data-section="experience"]',
          ]
          
          for (const selector of experienceSectionSelectors) {
            try {
              const section = document.querySelector(selector)
              if (section) {
                experienceSection = section.closest("section") || section
                console.log("Found experience section via ID selector:", selector)
                break
              }
            } catch (e) {}
          }
          
          // Fallback: look for section with h2 containing "Experience"
          if (!experienceSection) {
            const allSections = document.querySelectorAll("section, div.artdeco-card, div.pvs-list__container")
            for (const section of allSections) {
              const h2 = section.querySelector("h2, .pvs-header__title")
              if (h2 && h2.textContent.toLowerCase().includes("experience")) {
                experienceSection = section
                console.log("Found experience section by h2 content:", experienceSection.className)
                break
              }
            }
          }

          if (experienceSection) {
            // Updated selectors for current LinkedIn experience items
            const experienceListItems = experienceSection.querySelectorAll(
              "li.pvs-list__paged-list-item, li.artdeco-list__item, ul > li.pvs-list__item--line-separated, div.pvs-list > ul > li, li[class*='pvs-list']",
            )
            console.log(`Found ${experienceListItems.length} potential experience list items.`)

            for (const listItem of experienceListItems) {
              console.log("Processing list item:", listItem.innerText.substring(0, 100).replace(/\n/g, " ") + "...")

              const itemText = listItem.innerText || ""
              const isCurrent = itemText.toLowerCase().includes("present")

              if (!isCurrent) {
                console.log("Skipping non-current item.")
                continue
              }

              let itemRole = ""
              let itemCompany = ""

              const roleCandidateSpans = listItem.querySelectorAll(
                'div.display-flex.flex-column.align-self-center.flex-grow-1 > div > div > span[aria-hidden="true"]',
              )
              if (roleCandidateSpans.length > 0) {
                const firstSpanText = roleCandidateSpans[0].textContent.trim()
                if (
                  firstSpanText &&
                  firstSpanText.length > 1 &&
                  !firstSpanText.match(/(\d{4}\s*-\s*\d{4})|(present)|(·)/i)
                ) {
                  if (firstSpanText !== "FJ Labs" || !itemText.includes("Partner")) {
                    itemRole = firstSpanText
                    console.log("Potential role from primary span:", itemRole)
                  }
                }
              }

              const companyCandidateSpans = listItem.querySelectorAll(
                'div.display-flex.flex-column.align-self-center.flex-grow-1 span.t-14.t-normal[aria-hidden="true"]',
              )
              if (companyCandidateSpans.length > 0) {
                let companyText = companyCandidateSpans[0].textContent.trim()
                if (companyText) {
                  if (companyText.includes("•")) {
                    companyText = companyText.split("•")[0].trim()
                  }
                  companyText = companyText
                    .replace(/\s*(Permanent Full-time|Full-time|Part-time|Contract)\s*$/i, "")
                    .trim()

                  if (companyText.length > 1 && companyText.toLowerCase() !== itemRole.toLowerCase()) {
                    itemCompany = companyText
                    console.log("Potential company from secondary span (cleaned):", itemCompany)
                  }
                }
              }

              if (itemText.includes("Partner") && itemText.includes("FJ Labs")) {
                itemRole = "Partner"
                itemCompany = "FJ Labs"
                console.log("Applied specific pattern: Partner at FJ Labs")
              } else if (itemText.includes("Investor") && itemText.includes("FJ Labs")) {
                itemRole = "Investor"
                itemCompany = "FJ Labs"
                console.log("Applied specific pattern: Investor at FJ Labs")
              }

              if ((!itemRole || !itemCompany) && itemRole !== "FJ Labs") {
                console.log("Role/Company still missing or incomplete, trying general extraction within item...")
                const allSpansInItem = listItem.querySelectorAll('span[aria-hidden="true"]')
                const relevantTexts = []
                allSpansInItem.forEach((span) => {
                  const text = span.textContent.trim()
                  if (
                    text &&
                    text.length > 1 &&
                    !text.match(/(\d{4}\s*-\s*\d{4})|(present)|(·)|(full-time)|(part-time)|(contract)|yrs|mos/i) &&
                    !text.includes(",")
                  ) {
                    relevantTexts.push(text)
                  }
                })
                console.log("Relevant texts from all spans in item:", relevantTexts)

                if (relevantTexts.length > 0 && !itemRole) {
                  itemRole = relevantTexts[0]
                  console.log("General extraction - Role:", itemRole)
                }
                if (relevantTexts.length > 1 && !itemCompany) {
                  let potentialCompany = relevantTexts.find((t) => t.toLowerCase() !== itemRole.toLowerCase())
                  if (potentialCompany) {
                    if (potentialCompany.includes("•")) {
                      potentialCompany = potentialCompany.split("•")[0].trim()
                    }
                    potentialCompany = potentialCompany
                      .replace(/\s*(Permanent Full-time|Full-time|Part-time|Contract)\s*$/i, "")
                      .trim()
                    itemCompany = potentialCompany
                    console.log("General extraction - Company (cleaned):", itemCompany)
                  }
                }
              }

              if (itemRole && itemCompany && itemRole.toLowerCase() !== itemCompany.toLowerCase()) {
                role = itemRole
                company = itemCompany
                console.log("SUCCESS: Role:", role, "Company:", company)
                break
              } else if (itemRole && !itemCompany) {
                const companyLinkElement = listItem.querySelector('a[href*="/company/"] span[aria-hidden="true"]')
                if (companyLinkElement && companyLinkElement.textContent.trim().length > 1) {
                  let linkedCompany = companyLinkElement.textContent.trim()
                  if (linkedCompany.includes("•")) {
                    linkedCompany = linkedCompany.split("•")[0].trim()
                  }
                  linkedCompany = linkedCompany
                    .replace(/\s*(Permanent Full-time|Full-time|Part-time|Contract)\s*$/i, "")
                    .trim()

                  if (itemRole.toLowerCase() !== linkedCompany.toLowerCase()) {
                    role = itemRole
                    company = linkedCompany
                    console.log("SUCCESS (role + linked company): Role:", role, "Company:", company)
                    break
                  }
                } else {
                  role = itemRole
                  console.log("PARTIAL SUCCESS (role only): Role:", role)
                  break
                }
              }
            }
          } else {
            console.log("Experience section not found.")
          }

          const cleanUrl = window.location.href.split("?")[0].split("#")[0]
          const result = {
            name: name || "Unknown",
            role: role || "",
            company: company || "",
            profileUrl: cleanUrl,
            isFirstDegreeConnection: isFirstDegreeConnection,
          }
          console.log("Final extraction result:", result)
          return result
        },
      })
      return results[0].result
    } catch (error) {
      console.error("Profile extraction error:", error)
      try {
        // Access chrome globally as it's available in extension contexts
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        return {
          name: "Profile User",
          role: "",
          company: "",
          profileUrl: tab && tab.url ? tab.url.split("?")[0].split("#")[0] : "Unknown",
          isFirstDegreeConnection: false,
        }
      } catch (e) {
        return {
          name: "Profile User",
          role: "",
          company: "",
          profileUrl: "Unknown",
          isFirstDegreeConnection: false,
        }
      }
    }
  }
}
