// Google Sheets API interactions
import { CONFIG } from "./config.js"

export class SheetsAPI {
  constructor(authManager) {
    this.authManager = authManager
  }

  async testConnection(spreadsheetId) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
    console.log("Testing API with URL:", url)

    try {
      const response = await this.authManager.makeAuthenticatedRequest(url)
      const result = await response.json()
      console.log("API test response:", response.status, result)

      if (!response.ok) {
        const errorMessage = result.error?.message || "Unknown error"
        throw new Error(`API Error (${response.status}): ${errorMessage}`)
      }

      return true
    } catch (error) {
      console.error("API test failed:", error)
      throw error
    }
  }

  async createHeaders(spreadsheetId) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:V1?valueInputOption=RAW`
    console.log("Creating headers with URL:", url)

    try {
      const response = await this.authManager.makeAuthenticatedRequest(url, {
        method: "PUT",
        body: JSON.stringify({ values: [CONFIG.SPREADSHEET_HEADERS] }),
      })

      const result = await response.json()
      console.log("Headers creation response:", response.status, result)

      if (!response.ok) {
        const errorMessage = result.error?.message || "Unknown error"
        throw new Error(`API Error (${response.status}): ${errorMessage}`)
      }

      return result
    } catch (error) {
      console.error("Headers creation failed:", error)
      throw error
    }
  }

  async findExistingContact(spreadsheetId, profileUrl) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:V`
    const response = await this.authManager.makeAuthenticatedRequest(url)
    const data = await response.json()

    if (!data.values) return null

    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i]
      if (row[1] === profileUrl) {
        return { rowIndex: i + 1, data: row }
      }
    }
    return null
  }

  async createNewContact(spreadsheetId, profileData, cohort) {
    const timestamp = new Date().toISOString()
    const rowData = [
      profileData.name, // A: Name
      profileData.profileUrl, // B: LinkedIn Profile URL
      profileData.company, // C: Company
      profileData.role, // D: Role/Title
      cohort, // E: Cohort
      "", // F: Warmup
      "", // G: Warmup Timestamp
      "", // H: Connect
      "", // I: Connect Timestamp
      "", // J: Chatting
      "", // K: Chatting Timestamp
      "", // L: CTA
      "", // M: CTA Timestamp
      "", // N: Interest
      "", // O: Interest Timestamp
      "", // P: Converted
      "", // Q: Converted Timestamp
      timestamp, // R: Date Added
      "", // S: Notes
      "", // T: Type
      "", // U: Closed
      "", // V: Closure Reason
    ]

    console.log("Creating new contact with data:", rowData)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:V:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`

    try {
      const response = await this.authManager.makeAuthenticatedRequest(url, {
        method: "POST",
        body: JSON.stringify({ values: [rowData] }),
      })

      const result = await response.json()
      console.log("New contact creation response:", response.status, result)

      if (!response.ok) {
        const errorMessage = result.error?.message || "Unknown error"
        throw new Error(`API Error (${response.status}): ${errorMessage}`)
      }

      const rowIndex = result.updates?.updatedRange?.match(/\d+$/)?.[0] || 2
      return { rowIndex: Number.parseInt(rowIndex), data: rowData }
    } catch (error) {
      console.error("New contact creation failed:", error)
      throw error
    }
  }

  async updateCell(spreadsheetId, range, value) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`

    const response = await this.authManager.makeAuthenticatedRequest(url, {
      method: "PUT",
      body: JSON.stringify({ values: [[value]] }),
    })

    if (!response.ok) {
      const result = await response.json()
      const errorMessage = result.error?.message || "Unknown error"
      throw new Error(`Failed to update ${range}: ${errorMessage}`)
    }

    return response
  }

  async updateRange(spreadsheetId, range, values) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`

    const response = await this.authManager.makeAuthenticatedRequest(url, {
      method: "PUT",
      body: JSON.stringify({ values: [values] }),
    })

    if (!response.ok) {
      const result = await response.json()
      const errorMessage = result.error?.message || "Unknown error"
      throw new Error(`Failed to update ${range}: ${errorMessage}`)
    }

    return response
  }
}
