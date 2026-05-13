// Google Sheets API interactions
import { CONFIG } from "./config.js"
import { Utils } from "./utils.js"

export class SheetsAPI {
  constructor(authManager) {
    this.authManager = authManager
  }

  async testConnection(spreadsheetId) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
    try {
      const response = await this.authManager.makeAuthenticatedRequest(url)
      if (!response.ok) {
        const result = await response.json()
        throw new Error(`API Error (${response.status}): ${result.error?.message || "Unknown error"}`)
      }
      return true
    } catch (error) {
      console.error("API test failed:", error)
      throw error
    }
  }

  async createHeaders(spreadsheetId) {
    const lastColumnLetter = Utils.getColumnLetter(CONFIG.SPREADSHEET_HEADERS.length - 1)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:${lastColumnLetter}1?valueInputOption=RAW`
    console.log("Creating headers with URL:", url)

    try {
      const response = await this.authManager.makeAuthenticatedRequest(url, {
        method: "PUT",
        body: JSON.stringify({ values: [CONFIG.SPREADSHEET_HEADERS] }),
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(`API Error (${response.status}): ${result.error?.message || "Unknown error"}`)
      }
      return await response.json()
    } catch (error) {
      console.error("Headers creation failed:", error)
      throw error
    }
  }

  async findExistingContact(spreadsheetId, profileUrl) {
    const lastColumnLetter = Utils.getColumnLetter(CONFIG.SPREADSHEET_HEADERS.length - 1)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:${lastColumnLetter}`
    const response = await this.authManager.makeAuthenticatedRequest(url)
    const data = await response.json()

    if (!data.values || data.values.length < 2) return null // No data beyond headers

    const profileUrlIndex = CONFIG.COLUMN_MAPPING.LINKEDIN_PROFILE_URL

    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i]
      if (row[profileUrlIndex] === profileUrl) {
        return { rowIndex: i + 1, data: row }
      }
    }
    return null
  }

  async createNewContact(spreadsheetId, profileData, cohort) {
    const rowData = new Array(CONFIG.SPREADSHEET_HEADERS.length).fill("")

    // Use COLUMN_MAPPING to place data in the correct columns
    rowData[CONFIG.COLUMN_MAPPING.STATUS] = "OPEN"
    rowData[CONFIG.COLUMN_MAPPING.NAME] = profileData.name
    rowData[CONFIG.COLUMN_MAPPING.LINKEDIN_PROFILE_URL] = profileData.profileUrl
    rowData[CONFIG.COLUMN_MAPPING.COMPANY] = profileData.company
    rowData[CONFIG.COLUMN_MAPPING.ROLE_TITLE] = profileData.role
    rowData[CONFIG.COLUMN_MAPPING.COHORT] = cohort
    rowData[CONFIG.COLUMN_MAPPING.DATE_ADDED] = new Date().toISOString()

    console.log("Creating new contact with data:", rowData)
    const lastColumnLetter = Utils.getColumnLetter(CONFIG.SPREADSHEET_HEADERS.length - 1)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`

    try {
      const response = await this.authManager.makeAuthenticatedRequest(url, {
        method: "POST",
        body: JSON.stringify({ values: [rowData] }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(`API Error (${response.status}): ${result.error?.message || "Unknown error"}`)
      }
      const updatedRange = result.updates?.updatedRange
      const rowIndex = updatedRange ? Number.parseInt(updatedRange.match(/(\d+)$/)[0], 10) : 2
      return { rowIndex, data: rowData }
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
      throw new Error(`Failed to update ${range}: ${result.error?.message || "Unknown error"}`)
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
      throw new Error(`Failed to update ${range}: ${result.error?.message || "Unknown error"}`)
    }
    return response
  }
}
