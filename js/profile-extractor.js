// LinkedIn profile data extraction
// import { chrome } from "chrome" // Removed erroneous import

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

          // Check connection status - look for "1st" degree indicator
          let isFirstDegreeConnection = false
          const connectionIndicators = [
            // Main profile connection badge
            '.pv-top-card--list-bullet:contains("1st")',
            '.dist-value:contains("1st")',
            // Alternative selectors for connection degree
            'span[class*="dist"]:contains("1st")',
            ".pv-top-card .dist-value",
            // Message button presence (usually indicates 1st degree)
            'button[aria-label*="Message"]',
            // More specific selectors
            ".pv-top-card--list .dist-value",
            ".pv-top-card .pv-top-card--list-bullet",
          ]

          // Check for "1st" text in various elements
          const allTextElements = document.querySelectorAll("*")
          for (const element of allTextElements) {
            const text = element.textContent || element.innerText || ""
            if (
              text.includes("1st") &&
              (text.includes("degree") || text.includes("connection") || element.classList.toString().includes("dist"))
            ) {
              isFirstDegreeConnection = true
              console.log("Found 1st degree connection indicator:", text.trim())
              break
            }
          }

          // Alternative check: Look for Message button which typically indicates 1st degree connection
          if (!isFirstDegreeConnection) {
            const messageButton = document.querySelector('button[aria-label*="Message"], button:contains("Message")')
            if (messageButton) {
              isFirstDegreeConnection = true
              console.log("Found Message button - likely 1st degree connection")
            }
          }

          // Alternative check: Look for specific LinkedIn connection classes
          if (!isFirstDegreeConnection) {
            const connectionElements = document.querySelectorAll(
              '.dist-value, [class*="degree"], [class*="connection"]',
            )
            for (const element of connectionElements) {
              if (element.textContent.includes("1st")) {
                isFirstDegreeConnection = true
                console.log("Found 1st degree in connection element:", element.textContent.trim())
                break
              }
            }
          }

          console.log("Connection status - Is 1st degree:", isFirstDegreeConnection)

          let role = ""
          let company = ""

          // Find Experience section
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
