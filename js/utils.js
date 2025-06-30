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
    if (CONFIG.SPREADSHEET_ID_REGEX.test(input)) {
      return input
    }

    for (const pattern of CONFIG.URL_PATTERNS) {
      const match = input.match(pattern)
      if (match?.[1]) {
        return match[1]
      }
    }
    return null
  }

  static isLinkedInProfile(url) {
    return (
      url?.includes("linkedin.com/in/") &&
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

  static formatTimestamp(timestamp) {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  static concatenateNotes(notes, closureReason) {
    const parts = [notes, closureReason].filter((part) => part?.trim())
    return parts.length > 0 ? parts.join(" | ") : ""
  }
}
