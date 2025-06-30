// LinkedIn profile data extraction
import { chrome } from "chrome"

export class ProfileExtractor {
  static async extractProfileData() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
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
              break
            }
          }

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
              if (experienceSection) break
            }
          }

          if (!experienceSection) {
            const allSections = document.querySelectorAll("section")
            for (const section of allSections) {
              const h2 = section.querySelector("h2")
              if (h2 && h2.textContent.toLowerCase().includes("experience")) {
                experienceSection = section
                break
              }
            }
          }

          if (experienceSection) {
            const experienceListItems = experienceSection.querySelectorAll(
              "ul > li.pvs-list__item--line-separated, ul > li.artdeco-list__item, div.pvs-list > ul > li",
            )

            for (const listItem of experienceListItems) {
              const itemText = listItem.innerText || ""
              const isCurrent = itemText.toLowerCase().includes("present")

              if (!isCurrent) continue

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
                  }
                }
              }

              // Special patterns
              if (itemText.includes("Partner") && itemText.includes("FJ Labs")) {
                itemRole = "Partner"
                itemCompany = "FJ Labs"
              } else if (itemText.includes("Investor") && itemText.includes("FJ Labs")) {
                itemRole = "Investor"
                itemCompany = "FJ Labs"
              }

              if ((!itemRole || !itemCompany) && itemRole !== "FJ Labs") {
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

                if (relevantTexts.length > 0 && !itemRole) {
                  itemRole = relevantTexts[0]
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
                  }
                }
              }

              if (itemRole && itemCompany && itemRole.toLowerCase() !== itemCompany.toLowerCase()) {
                role = itemRole
                company = itemCompany
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
                    break
                  }
                } else {
                  role = itemRole
                  break
                }
              }
            }
          }

          const cleanUrl = window.location.href.split("?")[0].split("#")[0]
          return {
            name: name || "Unknown",
            role: role || "",
            company: company || "",
            profileUrl: cleanUrl,
          }
        },
      })
      return results[0].result
    } catch (error) {
      console.error("Profile extraction error:", error)
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        return {
          name: "Profile User",
          role: "",
          company: "",
          profileUrl: tab && tab.url ? tab.url.split("?")[0].split("#")[0] : "Unknown",
        }
      } catch (e) {
        return {
          name: "Profile User",
          role: "",
          company: "",
          profileUrl: "Unknown",
        }
      }
    }
  }
}
