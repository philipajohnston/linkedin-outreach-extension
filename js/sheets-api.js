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
      const result = await response.json()

      if (!response.ok) {
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

    try {
      const response = await this.authManager.makeAuthenticatedRequest(url, {
        method: "PUT",
        body: JSON.stringify({ values: [CONFIG.SPREADSHEET_HEADERS] }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(`API Error (${response.status}): ${result.error?.message || "Unknown error"}`)
      }
      return result
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

    if (!data.values) return null

    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i]
      if (row[CONFIG.COLUMNS.PROFILE_URL] === profileUrl) {
        return { rowIndex: i + 1, data: row }
      }
    }
    return null
  }

  async createNewContact(spreadsheetId, profileData, cohort) {
    const timestamp = new Date().toISOString()
    const rowData = new Array(CONFIG.SPREADSHEET_HEADERS.length).fill("")

    // Populate row data using column mappings
    rowData[CONFIG.COLUMNS.STATUS] = ""
    rowData[CONFIG.COLUMNS.NAME] = profileData.name
    rowData[CONFIG.COLUMNS.PROFILE_URL] = profileData.profileUrl
    rowData[CONFIG.COLUMNS.COMPANY] = profileData.company
    rowData[CONFIG.COLUMNS.ROLE] = profileData.role
    rowData[CONFIG.COLUMNS.COHORT] = cohort
    rowData[CONFIG.COLUMNS.DATE_ADDED] = timestamp

    const lastColumnLetter = Utils.getColumnLetter(CONFIG.SPREADSHEET_HEADERS.length - 1)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:${lastColumnLetter}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`

    try {
      const response = await this.authManager.makeAuthenticatedRequest(url, {
        method: "POST",
        body: JSON.stringify({ values: [rowData] }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(`API Error (${response.status}): ${result.error?.message || "Unknown error"}`)
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
