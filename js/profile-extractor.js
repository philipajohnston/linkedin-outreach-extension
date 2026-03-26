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

          // Check connection status
          // PRIMARY METHOD: Check for "Connect" button - if present, they are NOT 1st degree (definitive)
          // This is the most reliable signal because LinkedIn always shows Connect for non-connections
          let isFirstDegreeConnection = false

          try {
            console.log("Checking for 1st degree connection status...")

            // DEFINITIVE CHECK: Look for a Connect button on the page
            // If there's a Connect button, the user is NOT a 1st degree connection
            let hasConnectButton = false
            const allButtons = document.querySelectorAll('button')
            
            for (const btn of allButtons) {
              const btnText = (btn.textContent || '').trim().toLowerCase()
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase()
              
              // Check for Connect button (but not "Connected" or "Pending")
              const isConnectButton = (
                btnText === 'connect' ||
                btnText.startsWith('connect ') ||
                ariaLabel === 'connect' ||
                ariaLabel.startsWith('connect ')
              )
              
              const isNotConnectedOrPending = (
                !btnText.includes('connected') &&
                !btnText.includes('pending') &&
                !ariaLabel.includes('connected') &&
                !ariaLabel.includes('pending')
              )
              
              if (isConnectButton && isNotConnectedOrPending) {
                hasConnectButton = true
                console.log("Found Connect button:", btnText || ariaLabel)
                break
              }
            }
            
            if (hasConnectButton) {
              // Connect button exists = NOT a 1st degree connection
              isFirstDegreeConnection = false
              console.log("Connect button found - confirmed NOT 1st degree connection")
            } else {
              // No Connect button - likely 1st degree, but verify with Message button
              const hasMessageButton = Array.from(allButtons).some(btn => {
                const text = (btn.textContent || '').trim().toLowerCase()
                return text === 'message'
              })
              
              if (hasMessageButton) {
                isFirstDegreeConnection = true
                console.log("No Connect button + Message button present - confirmed 1st degree connection")
              } else {
                // Neither button found - default to false (not connected)
                isFirstDegreeConnection = false
                console.log("Neither Connect nor Message button found - defaulting to NOT 1st degree")
              }
            }
            
          } catch (error) {
            console.log("Error in connection degree detection (non-fatal):", error)
            isFirstDegreeConnection = false
          }

          console.log("Final connection status - Is 1st degree:", isFirstDegreeConnection)

          let role = ""
          let company = ""

          // Strategy 1: Extract from Experience section (most reliable for structured data)
          // LinkedIn SDUI uses section with componentkey containing "ExperienceTopLevelSection"
          // Role/Company are in <p> elements within entity-collection-item divs
          let experienceSection = null
          
          // Try SDUI componentkey selectors first (current LinkedIn layout)
          const experienceSectionSelectors = [
            'section[componentkey*="ExperienceTopLevelSection"]',
            '[componentkey*="ExperienceTopLevelSection"]',
            'section[componentkey*="Experience"]',
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
                console.log("Found experience section via selector:", selector)
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
            console.log("Processing experience section...")
            
            // Current LinkedIn SDUI: Look for entity-collection-item divs containing <p> elements
            // Role is in first <p>, Company in second <p> (format: "Company · Full-time")
            const entityItems = experienceSection.querySelectorAll(
              '[componentkey*="entity-collection-item"], div[class*="entity-collection"]'
            )
            
            if (entityItems.length > 0) {
              console.log(`Found ${entityItems.length} entity items in experience section`)
              
              for (const item of entityItems) {
                const pElements = item.querySelectorAll('p')
                const itemText = item.innerText || ""
                const isCurrent = itemText.toLowerCase().includes("present")
                
                if (!isCurrent) {
                  console.log("Skipping non-current experience item")
                  continue
                }
                
                console.log(`Processing entity item with ${pElements.length} <p> elements`)
                
                let itemRole = ""
                let itemCompany = ""
                
                for (const p of pElements) {
                  const text = p.textContent?.trim() || ''
                  
                  // Skip empty, dates, and duration texts
                  if (!text || text.length < 2 || text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d)/i)) {
                    continue
                  }
                  
                  // Role pattern: "Co-founder | Head of AI" or just "Software Engineer"
                  if (!itemRole && !text.includes('·')) {
                    itemRole = text
                    console.log("Found role from <p>:", itemRole)
                  }
                  // Company pattern: "Kiwi AI · Full-time" 
                  else if (!itemCompany && text.includes('·')) {
                    itemCompany = text.split('·')[0].trim()
                    console.log("Found company from <p>:", itemCompany)
                  }
                }
                
                if (itemRole && itemCompany) {
                  role = itemRole
                  company = itemCompany
                  console.log("SUCCESS from SDUI experience: Role:", role, "Company:", company)
                  break
                }
              }
            }
            
            // Fallback to legacy list item extraction if SDUI approach didn't work
            if (!role || !company) {
              const experienceListItems = experienceSection.querySelectorAll(
                "li.pvs-list__paged-list-item, li.artdeco-list__item, ul > li.pvs-list__item--line-separated, div.pvs-list > ul > li, li[class*='pvs-list']",
              )
              console.log(`Fallback: Found ${experienceListItems.length} legacy experience list items.`)

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
            }
          } else {
            console.log("Experience section not found.")
          }
          
          // Strategy 2: Fallback to topcard headline if Experience didn't yield results
          if (!role || !company) {
            try {
              const topcardContainer = document.querySelector(
                '[data-sdui-component*="profileTopCardSection"], section[componentkey*="RvgTopcard"], section[componentkey*="Topcard"]'
              )
              
              if (topcardContainer) {
                console.log("Fallback: Extracting from topcard headline")
                
                const pElements = topcardContainer.querySelectorAll('p')
                
                for (const p of pElements) {
                  const text = p.textContent?.trim() || ''
                  
                  // Skip degree indicators and very short text
                  if (text.match(/^·?\s*(1st|2nd|3rd)\s*$/) || text.length < 5) {
                    continue
                  }
                  
                  // Skip location patterns
                  if (text.match(/,\s*(United States|USA|UK|Canada|Australia|Germany|France|India)/i)) {
                    continue
                  }
                  
                  // Headline pattern: contains job titles with | or @ separators
                  if (!role && (text.includes('|') || text.includes('@') || text.includes(' at '))) {
                    const parts = text.split(/\s*[|]\s*/)
                    if (parts.length > 0) {
                      let primaryRole = parts[0].trim()
                      
                      if (primaryRole.includes('@')) {
                        const atParts = primaryRole.split('@')
                        primaryRole = atParts[0].trim()
                        if (!company && atParts[1]) {
                          company = atParts[1].trim()
                        }
                      }
                      
                      if (primaryRole && primaryRole.length > 2) {
                        role = primaryRole
                        console.log("Fallback: Extracted role from headline:", role)
                      }
                    }
                    
                    if (!company) {
                      const atMatch = text.match(/@\s*([^|]+)/)
                      if (atMatch) {
                        company = atMatch[1].trim()
                        console.log("Fallback: Extracted company from @ pattern:", company)
                      }
                    }
                  }
                  
                  // Company/education line pattern
                  if (!company && text.includes('·') && !text.includes('@') && !text.includes('|')) {
                    const companyPart = text.split('·')[0].trim()
                    if (companyPart && companyPart.length > 2) {
                      company = companyPart
                      console.log("Fallback: Extracted company from company line:", company)
                    }
                  }
                }
              }
            } catch (e) {
              console.log("Error in topcard fallback extraction:", e)
            }
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
