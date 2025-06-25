// Utility functions
import { CONFIG } from "./config.js"

export class Utils {
  static getColumnLetter(index) {
    let letter = ""
    while (index >= 0) {
      letter = String.fromCharCode(65 + (index % 26)) + letter
      index = Math.floor(index / 26) - 1
    }
    return letter
  }

  static extractSpreadsheetId(input) {
    console.log("Extracting spreadsheet ID from:", input)

    if (CONFIG.SPREADSHEET_ID_REGEX.test(input)) {
      console.log("Input is already a valid spreadsheet ID")
      return input
    }

    for (const pattern of CONFIG.URL_PATTERNS) {
      const match = input.match(pattern)
      if (match && match[1]) {
        console.log("Extracted ID using pattern:", pattern, "Result:", match[1])
        return match[1]
      }
    }

    console.log("Could not extract spreadsheet ID from input")
    return null
  }

  static isLinkedInProfile(url) {
    if (!url) return false
    return (
      url.includes("linkedin.com/in/") &&
      !url.includes("/recent-activity") &&
      !url.includes("/detail/") &&
      !url.includes("/overlay/")
    )
  }

  static debounce(func, delay) {
    let timeoutId
    return (...args) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func.apply(this, args), delay)
    }
  }

  static safeGetElement(id) {
    const element = document.getElementById(id)
    if (!element) {
      console.warn(`Element with id '${id}' not found`)
    }
    return element
  }
}
