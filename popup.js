// Main application controller
import { CONFIG } from "./js/config.js"
import { Utils } from "./js/utils.js"
import { AuthManager } from "./js/auth-manager.js"
import { UIManager } from "./js/ui-manager.js"
import { SheetsAPI } from "./js/sheets-api.js"
import { ContactManager } from "./js/contact-manager.js"
import { SheetManager } from "./js/sheet-manager.js"
//import { chrome } from "chrome"

class LinkedInOutreachTracker {
  constructor() {
    this.authManager = new AuthManager()
    this.uiManager = new UIManager()
    this.sheetsAPI = new SheetsAPI(this.authManager)
    this.contactManager = new ContactManager(this.sheetsAPI, this.uiManager)
    this.sheetManager = new SheetManager()

    this.spreadsheetId = null
    this.currentCohort = ""

    this.debouncedSaveCohort = Utils.debounce(() => this.saveField("COHORT", "cohort-input"), CONFIG.DEBOUNCE_DELAY)
    this.debouncedSaveNotes = Utils.debounce(() => this.saveField("NOTES", "notes-input"), CONFIG.DEBOUNCE_DELAY)

    this.init()
  }

  async init() {
    try {
      console.log("Initializing LinkedIn Outreach Tracker...")
      this.uiManager.showLoading()

      await this.sheetManager.loadSavedSheets()
      const stored = await chrome.storage.local.get(["spreadsheetId", "currentCohort"])
      this.spreadsheetId = stored.spreadsheetId || this.sheetManager.getCurrentSheet()?.id || null
      this.currentCohort = stored.currentCohort || ""

      this.uiManager.updateCurrentSheetDisplay(this.sheetManager.getCurrentSheet()?.name)
      this.uiManager.populateSheetSelector(this.sheetManager.getSavedSheets(), this.spreadsheetId)

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!Utils.isLinkedInProfile(tab.url)) {
        this.uiManager.hideLoading()
        this.uiManager.showMessage("Please navigate to a LinkedIn profile page.", "error", 0)
        return
      }

      this.setupEventListeners()

      const hasToken = await this.authManager.getAuthToken(false)
      this.uiManager.updateAuthIndicator(hasToken)

      if (hasToken) {
        if (this.spreadsheetId) {
          await this.contactManager.loadAvailableTypes(this.spreadsheetId)
          await this.loadContactData(tab.url)
        } else {
          this.uiManager.hideLoading()
          this.uiManager.showSection("setup")
        }
      } else {
        this.uiManager.hideLoading()
        this.uiManager.showSection("auth")
      }
    } catch (error) {
      console.error("Initialization error:", error)
      this.uiManager.hideLoading()
      this.uiManager.showMessage(`Initialization failed: ${error.message}`, "error")
    }
  }

  setupEventListeners() {
    const addListener = (id, event, handler) => {
      const element = Utils.safeGetElement(id)
      if (element) element.addEventListener(event, handler.bind(this))
    }

    addListener("auth-btn", "click", this.authenticateUser)
    addListener("setup-btn", "click", this.setupSpreadsheet)
    addListener("test-api-btn", "click", this.testApiConnection)
    addListener("settings-toggle", "click", this.uiManager.toggleSettings)
    addListener("clear-cache-btn", "click", this.clearCache)
    addListener("refresh-connection-btn", "click", this.refreshConnection)
    addListener("force-reauth-btn", "click", this.forceReauth)
    addListener("refresh-btn", "click", this.reloadContactData)
    addListener("reset-btn", "click", this.resetSetup)
    addListener("sheet-selector", "change", this.handleSheetSelection)
    addListener("type-select", "change", this.handleTypeSelection)
    addListener("closed-checkbox", "change", this.handleClosedChange)
    addListener("cohort-input", "input", this.debouncedSaveCohort)
    addListener("notes-input", "input", this.debouncedSaveNotes)

    document.addEventListener("change", (e) => {
      if (e.target.id && e.target.id.startsWith("seq-")) {
        const step = e.target.id.replace("seq-", "")
        this.updateSequenceStep(step, e.target.checked)
      }
    })
  }

  async reloadContactData() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    await this.loadContactData(tab.url)
  }

  async loadContactData(tabUrl) {
    try {
      const profileUrl = tabUrl.split("?")[0].split("#")[0]
      const noteKey = `connectionNote_${profileUrl}`
      const stored = await chrome.storage.local.get(noteKey)
      const pendingNote = stored[noteKey]

      const contact = await this.contactManager.loadContactData(this.spreadsheetId, this.currentCohort)

      if (pendingNote && contact) {
        await this.contactManager.saveConnectionNote(this.spreadsheetId, pendingNote)
        await chrome.storage.local.remove(noteKey)
      }

      this.populateContactForm(contact)
    } catch (error) {
      console.error("Failed to load contact data:", error)
      this.uiManager.showMessage(`Failed to load contact data: ${error.message}`, "error")
    }
  }

  populateContactForm(contact) {
    if (!contact) return

    const cohortInput = Utils.safeGetElement("cohort-input")
    const notesInput = Utils.safeGetElement("notes-input")
    const typeSelect = Utils.safeGetElement("type-select")

    if (cohortInput) cohortInput.value = contact.cohort || ""
    if (notesInput) notesInput.value = contact.notes || ""

    // Populate type dropdown and set value
    this.contactManager.populateTypeDropdown()
    if (typeSelect) typeSelect.value = contact.type || ""
  }

  async handleSheetSelection(event) {
    const value = event.target.value
    if (value === "add-new") {
      this.uiManager.showSection("setup")
      const spreadsheetInput = Utils.safeGetElement("spreadsheet-id")
      const sheetNameInput = Utils.safeGetElement("sheet-name")
      if (spreadsheetInput) spreadsheetInput.value = ""
      if (sheetNameInput) sheetNameInput.value = ""
      event.target.value = ""
    } else if (value && value !== this.spreadsheetId) {
      this.uiManager.showMessage("Switching sheets...", "success", 0)
      const success = await this.sheetManager.switchToSheet(value)
      if (success) {
        this.spreadsheetId = value
        this.uiManager.updateCurrentSheetDisplay(this.sheetManager.getCurrentSheet()?.name)
        await this.reloadContactData()
        this.uiManager.showMessage("✅ Sheet switched successfully!", "success")
        this.uiManager.closeSettings()
      } else {
        this.uiManager.showMessage("Failed to switch sheets.", "error")
      }
    }
  }

  async authenticateUser() {
    this.uiManager.showMessage("Authenticating with Google...", "success", 0)
    const success = await this.authManager.getAuthToken(true)
    this.uiManager.updateAuthIndicator(success)
    if (success) {
      this.uiManager.showMessage("✅ Authentication successful!", "success")
      setTimeout(() => {
        this.uiManager.hideMessage()
        if (this.spreadsheetId) this.reloadContactData()
        else this.uiManager.showSection("setup")
      }, 1500)
    } else {
      this.uiManager.showMessage("Authentication failed. Please try again.", "error")
    }
  }

  async setupSpreadsheet() {
    const spreadsheetInput = Utils.safeGetElement("spreadsheet-id")
    const sheetNameInput = Utils.safeGetElement("sheet-name")
    const inputValue = spreadsheetInput?.value?.trim()
    if (!inputValue) return this.uiManager.showMessage("Please enter a Google Sheets URL or ID.", "error")

    try {
      this.uiManager.showMessage("Validating spreadsheet...", "success", 0)
      const spreadsheetId = Utils.extractSpreadsheetId(inputValue)
      if (!spreadsheetId) return this.uiManager.showMessage("Invalid Google Sheets URL or ID.", "error")

      this.spreadsheetId = spreadsheetId
      await this.sheetsAPI.testConnection(spreadsheetId)
      await this.sheetsAPI.createHeaders(spreadsheetId)

      const customName = sheetNameInput?.value?.trim() || `Sheet ${new Date().toLocaleDateString()}`
      await this.sheetManager.saveSheet(spreadsheetId, customName)
      await chrome.storage.local.set({ spreadsheetId })
      await this.contactManager.loadAvailableTypes(spreadsheetId)

      this.uiManager.populateSheetSelector(this.sheetManager.getSavedSheets(), spreadsheetId)
      this.uiManager.updateCurrentSheetDisplay(customName)
      this.uiManager.showMessage("✅ Spreadsheet setup complete!", "success")
      setTimeout(() => this.reloadContactData(), 1000)
    } catch (error) {
      console.error("Setup error:", error)
      this.uiManager.showMessage(`Setup failed: ${error.message}`, "error")
      this.spreadsheetId = null
    }
  }

  async testApiConnection() {
    const spreadsheetInput = Utils.safeGetElement("spreadsheet-id")
    const inputValue = spreadsheetInput?.value?.trim()
    if (!inputValue) return this.uiManager.showMessage("Please enter a spreadsheet URL first.", "error")
    const spreadsheetId = Utils.extractSpreadsheetId(inputValue)
    if (!spreadsheetId) return this.uiManager.showMessage("Invalid Google Sheets URL or ID.", "error")

    try {
      this.uiManager.showMessage("Testing API connection...", "success", 0)
      await this.sheetsAPI.testConnection(spreadsheetId)
      this.uiManager.showMessage("✅ API connection successful!", "success")
    } catch (error) {
      this.uiManager.showMessage(`Connection failed: ${error.message}`, "error")
    }
  }

  async handleTypeSelection(event) {
    const value = event.target.value
    if (value === "add-new") {
      const newType = prompt("Enter new contact type:")
      if (newType && !this.contactManager.availableTypes.includes(newType)) {
        this.contactManager.availableTypes.push(newType)
        await this.contactManager.saveAvailableTypes(this.spreadsheetId)
        this.contactManager.populateTypeDropdown()
        event.target.value = newType
        await this.saveField("TYPE", "type-select")
        this.uiManager.showMessage(`✅ Type "${newType}" added!`, "success")
      } else {
        event.target.value = this.contactManager.currentContact?.type || ""
      }
    } else if (value !== this.contactManager.currentContact?.type) {
      await this.saveField("TYPE", "type-select")
    }
  }

  async handleClosedChange(event) {
    const isClosed = event.target.checked
    let reason = null
    if (isClosed) {
      reason = prompt("Please enter a reason for closing this contact:")
      if (reason === null) {
        // User cancelled the prompt
        event.target.checked = false
        return
      }
    }
    await this.contactManager.updateClosedStatus(this.spreadsheetId, isClosed, reason)
  }

  async updateSequenceStep(step, completed) {
    try {
      await this.contactManager.updateSequenceStep(this.spreadsheetId, step, completed)
      this.uiManager.showMessage(`✅ ${step} step updated successfully!`, "success")
    } catch (error) {
      this.uiManager.showMessage(`Failed to update ${step}: ${error.message}`, "error")
    }
  }

  async saveField(configKey, elementId) {
    const inputElement = Utils.safeGetElement(elementId)
    if (!inputElement || !this.contactManager.currentContact) return

    const value = inputElement.value
    const contactKey = configKey.toLowerCase()

    if (this.contactManager.currentContact[contactKey] === value) return // No change

    try {
      const columnIndex = CONFIG.COLUMN_MAPPING[configKey]
      if (columnIndex === undefined) {
        console.error(`Invalid config key: ${configKey}`)
        return
      }

      const range = `Sheet1!${Utils.getColumnLetter(columnIndex)}${this.contactManager.currentContact.rowIndex}`
      await this.sheetsAPI.updateCell(this.spreadsheetId, range, value)
      this.contactManager.currentContact[contactKey] = value

      if (configKey === "COHORT") {
        this.currentCohort = value
        await chrome.storage.local.set({ currentCohort: value })
      }
    } catch (error) {
      console.error(`Save ${contactKey} error:`, error)
      this.uiManager.showMessage(`Failed to save ${contactKey}.`, "error")
    }
  }

  async clearCache() {
    await chrome.storage.local.clear()
    this.resetState()
    this.uiManager.updateAuthIndicator(false)
    this.uiManager.showSection("auth")
    this.uiManager.showMessage("✅ Cache cleared successfully!", "success")
    this.uiManager.closeSettings()
  }

  async refreshConnection() {
    this.uiManager.showMessage("Refreshing connection...", "success", 0)
    await this.reloadContactData()
    this.uiManager.showMessage("✅ Connection refreshed successfully!", "success")
    this.uiManager.closeSettings()
  }

  async forceReauth() {
    this.authManager.clearAuth()
    this.uiManager.updateAuthIndicator(false)
    this.uiManager.showSection("auth")
    this.uiManager.showMessage("Please sign in with Google again.", "success")
    this.uiManager.closeSettings()
  }

  async resetSetup() {
    await chrome.storage.local.clear()
    this.authManager.clearAuth()
    this.resetState()
    this.uiManager.updateAuthIndicator(false)
    this.uiManager.showSection("auth")
    this.uiManager.showMessage("Setup reset. Please authenticate again.", "success")
  }

  resetState() {
    this.spreadsheetId = null
    this.currentCohort = ""
    this.contactManager.currentContact = null
    this.contactManager.availableTypes = []
    this.sheetManager.savedSheets = []
    this.sheetManager.currentSheetId = null
    this.uiManager.populateSheetSelector([], null)
    this.uiManager.updateCurrentSheetDisplay(null)
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new LinkedInOutreachTracker()
})
