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

          // Extract name
          const nameSelectors = [
            "h1.text-heading-xlarge",
            ".pv-text-details__left-panel h1",
            'h1[data-anonymize="person-name"]',
            "main h1",
            ".pv-top-card--list h1",
            "h1[slot='title']",
          ]
          let name = ""
          for (const selector of nameSelectors) {
            const element = document.querySelector(selector)
            if (element && element.textContent.trim()) {
              name = element.textContent.trim()
              console.log("Found name:", name)
              break
            }
          }

          // Check connection status - look for "1st" degree indicator near the name
          let isFirstDegreeConnection = false

          try {
            console.log("Checking for 1st degree connection status...")

            // Strategy: Look for the connection degree in the name/header area
            // The connection degree typically appears as the last element after name, verified badge, pronouns

            // First, try to find the main profile header container
            const profileHeaderSelectors = [
              ".pv-text-details__left-panel",
              ".pv-top-card--list",
              "main section:first-of-type",
              ".pv-top-card",
              '[data-section="topCard"]',
            ]

            let headerContainer = null
            for (const selector of profileHeaderSelectors) {
              headerContainer = document.querySelector(selector)
              if (headerContainer) {
                console.log("Found header container with selector:", selector)
                break
              }
            }

            if (headerContainer) {
              // Look for connection degree indicators within the header
              // These are typically small text elements that contain "1st", "2nd", "3rd"
              const degreeSelectors = [
                ".dist-value",
                '[class*="dist"]',
                ".pv-top-card--list-bullet",
                'span[class*="degree"]',
              ]

              // Check specific degree selector elements first
              for (const selector of degreeSelectors) {
                try {
                  const elements = headerContainer.querySelectorAll(selector)
                  for (const element of elements) {
                    const text = element.textContent?.trim() || ""
                    if (text === "1st" || text.includes("1st")) {
                      isFirstDegreeConnection = true
                      console.log("Found 1st degree connection via selector:", selector, "Text:", text)
                      break
                    }
                  }
                  if (isFirstDegreeConnection) break
                } catch (e) {
                  // Skip invalid selectors
                }
              }
              
              // Search all spans in header for "1st" text content
              if (!isFirstDegreeConnection) {
                const allSpans = headerContainer.querySelectorAll("span")
                for (const span of allSpans) {
                  const text = span.textContent?.trim() || ""
                  if (text === "1st" || text.match(/^1st$/)) {
                    isFirstDegreeConnection = true
                    console.log("Found 1st degree via span search:", text)
                    break
                  }
                }
              }

              // If not found with specific selectors, do a more comprehensive search
              if (!isFirstDegreeConnection) {
                console.log("Specific selectors failed, trying comprehensive search...")

                // Get all text-containing elements in the header area
                const allElements = headerContainer.querySelectorAll("*")
                const textElements = Array.from(allElements).filter((el) => {
                  const text = el.textContent?.trim() || ""
                  // Look for elements that contain degree indicators
                  return text.match(/^(1st|2nd|3rd)$/) || text.match(/\b(1st|2nd|3rd)\b/) || text.includes("degree")
                })

                console.log("Found potential degree elements:", textElements.length)

                for (const element of textElements) {
                  const text = element.textContent?.trim() || ""
                  console.log("Checking element text:", text)

                  // Check if this element specifically contains "1st"
                  if (text === "1st" || text.match(/\b1st\b/)) {
                    // Additional validation: make sure this isn't part of a larger text block
                    // and is likely the connection degree indicator
                    const elementRect = element.getBoundingClientRect()
                    const isSmallElement = elementRect.width < 100 && elementRect.height < 50

                    if (isSmallElement || text.length < 10) {
                      isFirstDegreeConnection = true
                      console.log("Found 1st degree connection via comprehensive search:", text)
                      break
                    }
                  }
                }
              }

              // Final fallback: look for "1st" in the immediate vicinity of the name
              if (!isFirstDegreeConnection) {
                console.log("Trying final fallback search near name...")

                // Find the name element and look for siblings or nearby elements
                const nameElement = headerContainer.querySelector('h1, [class*="name"], .pv-top-card--list h1')
                if (nameElement) {
                  const nameParent = nameElement.parentElement
                  if (nameParent) {
                    const nearbyText = nameParent.textContent || ""
                    // Look for "1st" that appears after the name but before other major content
                    const nameText = nameElement.textContent || ""
                    const afterNameText = nearbyText.substring(nearbyText.indexOf(nameText) + nameText.length)

                    if (afterNameText.match(/\b1st\b/) && afterNameText.indexOf("1st") < 100) {
                      isFirstDegreeConnection = true
                      console.log("Found 1st degree connection via name proximity search")
                    }
                  }
                }
              }
            } else {
              console.log("Could not find profile header container")
            }
          } catch (error) {
            console.log("Error in connection degree detection (non-fatal):", error)
            // Don't throw - let the rest of the extraction continue
            isFirstDegreeConnection = false
          }

          console.log("Final connection status - Is 1st degree:", isFirstDegreeConnection)

          let role = ""
          let company = ""

          // Find Experience section (existing logic)
          let experienceSection = null
          const sectionHeadings = document.querySelectorAll(
            "h2#experience, section[aria-labelledby='experience'] h2, div[id='experience'] ~ .pvs-header__container h2, section[id='experience'] h2",
          )
          for (const heading of sectionHeadings) {
            const headingText = heading.textContent.trim().toLowerCase()
            if (headingText.includes("experience")) {
              experienceSection = heading.closest("section, div.artdeco-card")
              if (experienceSection) {
                console.log("Found experience section container:", experienceSection.className)
                break
              }
            }
          }
          if (!experienceSection) {
            const allSections = document.querySelectorAll("section")
            for (const section of allSections) {
              const h2 = section.querySelector("h2")
              if (h2 && h2.textContent.toLowerCase().includes("experience")) {
                experienceSection = section
                console.log("Fallback: Found experience section by h2 content:", experienceSection.className)
                break
              }
            }
          }

          if (experienceSection) {
            const experienceListItems = experienceSection.querySelectorAll(
              "ul > li.pvs-list__item--line-separated, ul > li.artdeco-list__item, div.pvs-list > ul > li",
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
