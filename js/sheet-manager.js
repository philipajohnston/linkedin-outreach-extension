// Sheet management for multiple spreadsheets
export class SheetManager {
  constructor() {
    this.savedSheets = []
    this.currentSheetId = null
  }

  async loadSavedSheets() {
    try {
      const stored = await chrome.storage.local.get(["savedSheets", "currentSheetId"])
      this.savedSheets = stored.savedSheets || []
      this.currentSheetId = stored.currentSheetId || null
      console.log("Loaded saved sheets:", this.savedSheets)
      return this.savedSheets
    } catch (error) {
      console.error("Load saved sheets error:", error)
      this.savedSheets = []
      return []
    }
  }

  async saveSheet(spreadsheetId, customName) {
    try {
      // Check if sheet already exists
      const existingIndex = this.savedSheets.findIndex((sheet) => sheet.id === spreadsheetId)

      const sheetData = {
        id: spreadsheetId,
        name: customName,
        dateAdded: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      }

      if (existingIndex >= 0) {
        // Update existing sheet
        this.savedSheets[existingIndex] = { ...this.savedSheets[existingIndex], ...sheetData }
      } else {
        // Add new sheet
        this.savedSheets.push(sheetData)
      }

      // Sort by last used (most recent first)
      this.savedSheets.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))

      await chrome.storage.local.set({
        savedSheets: this.savedSheets,
        currentSheetId: spreadsheetId,
      })

      this.currentSheetId = spreadsheetId
      console.log("Sheet saved:", sheetData)
      return true
    } catch (error) {
      console.error("Save sheet error:", error)
      return false
    }
  }

  async switchToSheet(spreadsheetId) {
    try {
      // Update last used timestamp
      const sheetIndex = this.savedSheets.findIndex((sheet) => sheet.id === spreadsheetId)
      if (sheetIndex >= 0) {
        this.savedSheets[sheetIndex].lastUsed = new Date().toISOString()

        // Resort by last used
        this.savedSheets.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))

        await chrome.storage.local.set({
          savedSheets: this.savedSheets,
          currentSheetId: spreadsheetId,
          spreadsheetId: spreadsheetId, // Update the main spreadsheet ID
        })

        this.currentSheetId = spreadsheetId
        return true
      }
      return false
    } catch (error) {
      console.error("Switch sheet error:", error)
      return false
    }
  }

  async deleteSheet(spreadsheetId) {
    try {
      this.savedSheets = this.savedSheets.filter((sheet) => sheet.id !== spreadsheetId)

      // If we deleted the current sheet, clear current selection
      if (this.currentSheetId === spreadsheetId) {
        this.currentSheetId = this.savedSheets.length > 0 ? this.savedSheets[0].id : null
      }

      await chrome.storage.local.set({
        savedSheets: this.savedSheets,
        currentSheetId: this.currentSheetId,
      })

      return true
    } catch (error) {
      console.error("Delete sheet error:", error)
      return false
    }
  }

  getCurrentSheet() {
    return this.savedSheets.find((sheet) => sheet.id === this.currentSheetId) || null
  }

  getSavedSheets() {
    return this.savedSheets
  }
}
