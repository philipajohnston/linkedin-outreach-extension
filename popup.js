// Main application controller
import { CONFIG } from "./js/config.js"
import { Utils } from "./js/utils.js"
import { AuthManager } from "./js/auth-manager.js"
import { UIManager } from "./js/ui-manager.js"
import { SheetsAPI } from "./js/sheets-api.js"
import { ContactManager } from "./js/contact-manager.js"
import { SheetManager } from "./js/sheet-manager.js

class LinkedInOutreachTracker {
  constructor() {
    this.authManager = new AuthManager()
    this.uiManager = new UIManager()
    this.sheetsAPI = new SheetsAPI(this.authManager)
    this.contactManager = new ContactManager(this.sheetsAPI, this.uiManager)
    this.sheetManager = new SheetManager()

    this.spreadsheetId = null
    this.currentCohort = ""

    // Debounced save functions
    this.debouncedSaveCohort = Utils.debounce(() => this.saveCohort(true), CONFIG.DEBOUNCE_DELAY)
    this.debouncedSaveNotes = Utils.debounce(() => this.saveNotes(true), CONFIG.DEBOUNCE_DELAY)

    this.init()
  }

  async init() {
    try {
      console.log("Initializing LinkedIn Outreach Tracker...")
      this.uiManager.showLoading()

      // Load saved sheets and current sheet
      await this.sheetManager.loadSavedSheets()
      const currentSheet = this.sheetManager.getCurrentSheet()

      // Load stored data
      const stored = await chrome.storage.local.get(["spreadsheetId", "currentCohort"])
      this.spreadsheetId = stored.spreadsheetId || (currentSheet ? currentSheet.id : null)
      this.currentCohort = stored.currentCohort || ""

      // Update UI with sheet info
      this.updateSheetUI()

      // Check if we're on a LinkedIn profile page
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!Utils.isLinkedInProfile(tab.url)) {
        this.uiManager.hideLoading()
        this.uiManager.showMessage("Please navigate to a LinkedIn profile page.", "error", 0)
        return
      }

      this.setupEventListeners()

      // Try silent authentication
      const hasToken = await this.authManager.getAuthToken(false)
      console.log("Silent auth result:", hasToken)

      if (hasToken) {
        this.uiManager.updateAuthIndicator(true)
        if (this.spreadsheetId) {
          await this.contactManager.loadAvailableTypes(this.spreadsheetId)
          await this.contactManager.loadContactData(this.spreadsheetId, this.currentCohort)
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
      this.uiManager.showMessage("Failed to initialize extension.", "error")
    }
  }

  updateSheetUI() {
    const savedSheets = this.sheetManager.getSavedSheets()
    const currentSheet = this.sheetManager.getCurrentSheet()

    this.uiManager.populateSheetSelector(savedSheets, this.spreadsheetId)
    this.uiManager.updateCurrentSheetDisplay(currentSheet ? currentSheet.name : null)
  }

  setupEventListeners() {
    const addListener = (id, event, handler) => {
      const element = Utils.safeGetElement(id)
      if (element) element.addEventListener(event, handler)
    }

    // Auth
    addListener("auth-btn", "click", () => this.authenticateUser())

    // Setup
    addListener("setup-btn", "click", () => this.setupSpreadsheet())
    addListener("test-api-btn", "click", () => this.testApiConnection())

    // Settings
    addListener("settings-toggle", "click", (e) => {
      e.preventDefault()
      this.uiManager.toggleSettings()
    })
    addListener("clear-cache-btn", "click", () => this.clearCache())
    addListener("refresh-connection-btn", "click", () => this.refreshConnection())
    addListener("force-reauth-btn", "click", () => this.forceReauth())
    addListener("refresh-btn", "click", () => this.loadContactData())
    addListener("reset-btn", "click", () => this.resetSetup())

    // Sheet management
    addListener("sheet-selector", "change", (e) => this.handleSheetSelection(e))

    // Contact management
    addListener("type-select", "change", (e) => this.handleTypeSelection(e))
    addListener("closed-checkbox", "change", (e) => this.handleClosedChange(e))
    addListener("cohort-input", "input", () => this.debouncedSaveCohort())
    addListener("notes-input", "input", () => this.debouncedSaveNotes())

    // Sequence step handlers
    document.addEventListener("change", (e) => {
      if (e.target.id && e.target.id.startsWith("seq-")) {
        const step = e.target.id.replace("seq-", "")
        this.updateSequenceStep(step, e.target.checked)
      }
    })
  }

  async handleSheetSelection(event) {
    const value = event.target.value

    if (value === "add-new") {
      // Reset to setup mode for new sheet
      this.uiManager.showSection("setup")
      const spreadsheetInput = Utils.safeGetElement("spreadsheet-id")
      const sheetNameInput = Utils.safeGetElement("sheet-name")
      if (spreadsheetInput) spreadsheetInput.value = ""
      if (sheetNameInput) sheetNameInput.value = ""
      event.target.value = ""
    } else if (value && value !== this.spreadsheetId) {
      // Switch to existing sheet
      try {
        this.uiManager.showMessage("Switching sheets...", "success", 0)

        const success = await this.sheetManager.switchToSheet(value)
        if (success) {
          this.spreadsheetId = value
          this.updateSheetUI()

          // Load contact data for new sheet
          await this.contactManager.loadAvailableTypes(this.spreadsheetId)
          await this.contactManager.loadContactData(this.spreadsheetId, this.currentCohort)

          this.uiManager.showMessage("✅ Sheet switched successfully!", "success")
          this.uiManager.closeSettings()
        } else {
          this.uiManager.showMessage("Failed to switch sheets.", "error")
        }
      } catch (error) {
        console.error("Sheet switch error:", error)
        this.uiManager.showMessage("Failed to switch sheets: " + error.message, "error")
      }
    }
  }

  async authenticateUser() {
    try {
      this.uiManager.showMessage("Authenticating with Google...", "success", 0)
      const success = await this.authManager.getAuthToken(true)

      if (success) {
        this.uiManager.showMessage("✅ Authentication successful!", "success")
        this.uiManager.updateAuthIndicator(true)
        await this.authManager.testTokenValidity()

        setTimeout(() => {
          this.uiManager.hideMessage()
          if (this.spreadsheetId) {
            this.contactManager.loadAvailableTypes(this.spreadsheetId)
            this.loadContactData()
          } else {
            this.uiManager.showSection("setup")
          }
        }, 1500)
      } else {
        this.uiManager.showMessage("Authentication failed. Please try again.", "error")
        this.uiManager.showSection("auth")
      }
    } catch (error) {
      console.error("Authentication error:", error)
      this.uiManager.showMessage(`Authentication failed: ${error.message}`, "error")
      this.uiManager.showSection("auth")
    }
  }

  async setupSpreadsheet() {
    const spreadsheetInput = Utils.safeGetElement("spreadsheet-id")
    const sheetNameInput = Utils.safeGetElement("sheet-name")

    if (!spreadsheetInput) return

    const inputValue = spreadsheetInput.value.trim()
    if (!inputValue) {
      this.uiManager.showMessage("Please enter a Google Sheets URL or ID.", "error")
      return
    }

    if (!this.authManager.isAuthenticated) {
      this.uiManager.showMessage("Please authenticate with Google first.", "error")
      this.uiManager.showSection("auth")
      return
    }

    try {
      this.uiManager.showMessage("Validating spreadsheet...", "success", 0)

      const spreadsheetId = Utils.extractSpreadsheetId(inputValue)
      if (!spreadsheetId) {
        this.uiManager.showMessage("Invalid Google Sheets URL or ID. Please check your input.", "error")
        return
      }

      console.log("Extracted spreadsheet ID:", spreadsheetId)
      this.spreadsheetId = spreadsheetId

      // Test connection first
      this.uiManager.showMessage("Testing connection to spreadsheet...", "success", 0)
      await this.sheetsAPI.testConnection(spreadsheetId)

      // Create headers
      this.uiManager.showMessage("Setting up spreadsheet headers...", "success", 0)
      await this.sheetsAPI.createHeaders(spreadsheetId)

      // Save sheet with custom name
      const customName = sheetNameInput ? sheetNameInput.value.trim() : ""
      const sheetName = customName || `Sheet ${new Date().toLocaleDateString()}`

      await this.sheetManager.saveSheet(spreadsheetId, sheetName)
      await chrome.storage.local.set({ spreadsheetId })
      await this.contactManager.loadAvailableTypes(spreadsheetId)

      // Update UI
      this.updateSheetUI()

      this.uiManager.showMessage("✅ Spreadsheet setup complete!", "success")

      // Wait a moment then load contact data
      setTimeout(() => {
        this.loadContactData()
      }, 1000)
    } catch (error) {
      console.error("Setup error:", error)

      // Provide specific error messages
      if (error.message.includes("404")) {
        this.uiManager.showMessage(
          "Spreadsheet not found. Please check the URL and make sure the sheet exists.",
          "error",
        )
      } else if (error.message.includes("403")) {
        this.uiManager.showMessage(
          "Access denied. Please make sure you have edit permissions for this spreadsheet.",
          "error",
        )
      } else if (error.message.includes("Unable to parse range")) {
        this.uiManager.showMessage("Spreadsheet format error. Please try creating a new sheet.", "error")
      } else {
        this.uiManager.showMessage(`Setup failed: ${error.message}`, "error")
      }

      this.spreadsheetId = null
    }
  }

  async testApiConnection() {
    const spreadsheetInput = Utils.safeGetElement("spreadsheet-id")
    if (!spreadsheetInput) return

    const inputValue = spreadsheetInput.value.trim()
    if (!inputValue) {
      this.uiManager.showMessage("Please enter a spreadsheet URL first.", "error")
      return
    }

    const spreadsheetId = Utils.extractSpreadsheetId(inputValue)
    if (!spreadsheetId) {
      this.uiManager.showMessage("Invalid Google Sheets URL or ID.", "error")
      return
    }

    try {
      this.uiManager.showMessage("Testing API connection...", "success", 0)
      await this.sheetsAPI.testConnection(spreadsheetId)
      this.uiManager.showMessage("✅ API connection successful! Sheet access confirmed.", "success")
    } catch (error) {
      if (error.message.includes("404")) {
        this.uiManager.showMessage("Spreadsheet not found. Check your spreadsheet URL.", "error")
      } else if (error.message.includes("403")) {
        this.uiManager.showMessage("Access denied. Make sure you have permission to access the spreadsheet.", "error")
      } else {
        this.uiManager.showMessage(`Connection failed: ${error.message}`, "error")
      }
    }
  }

  async loadContactData() {
    try {
      // Get current tab and construct profile URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const profileUrl = tab.url.split("?")[0].split("#")[0]
      console.log("Current profile URL:", profileUrl)

      // Check for pending connection note BEFORE loading contact data
      const noteKey = `connectionNote_${profileUrl}`
      console.log("Looking for connection note with key:", noteKey)

      // Get all storage keys to debug
      const allStorage = await chrome.storage.local.get(null)
      console.log("All storage keys:", Object.keys(allStorage))
      console.log(
        "Storage keys matching connectionNote:",
        Object.keys(allStorage).filter((key) => key.startsWith("connectionNote_")),
      )

      const stored = await chrome.storage.local.get(noteKey)
      const pendingNote = stored[noteKey] || null

      if (pendingNote) {
        console.log("Found pending connection note:", pendingNote)
      } else {
        console.log("No pending connection note found for key:", noteKey)
      }

      // Load contact data
      const contact = await this.contactManager.loadContactData(this.spreadsheetId, this.currentCohort)

      // Now that contact is loaded, save the pending note if it exists
      if (pendingNote && this.contactManager.currentContact) {
        console.log("Attempting to save connection note to spreadsheet...")
        await this.contactManager.saveConnectionNote(this.spreadsheetId, pendingNote)
        await chrome.storage.local.remove(noteKey)
        console.log("Processed and cleared pending connection note.")
      } else if (pendingNote && !this.contactManager.currentContact) {
        console.log("Found pending note but no current contact loaded")
      }

      this.populateContactForm()
      console.log("Contact data loaded successfully:", contact)
    } catch (error) {
      console.error("Failed to load contact data:", error)
      this.uiManager.showMessage("Failed to load contact data: " + error.message, "error")
    }
  }

  populateContactForm() {
    const cohortInput = Utils.safeGetElement("cohort-input")
    const notesInput = Utils.safeGetElement("notes-input")

    if (cohortInput) cohortInput.value = this.currentCohort
    if (notesInput && this.contactManager.currentContact) {
      notesInput.value = this.contactManager.currentContact.data[18] || ""
    }

    this.contactManager.populateTypeDropdown()
    const typeSelect = Utils.safeGetElement("type-select")
    if (typeSelect && this.contactManager.currentContact) {
      typeSelect.value = this.contactManager.currentContact.data[19] || ""
    }
  }

  async handleTypeSelection(event) {
    const value = event.target.value

    if (value === "add-new") {
      // Inline type creation logic
      const select = event.target
      const input = document.createElement("input")
      input.type = "text"
      input.placeholder = "Enter new type..."
      input.style.cssText =
        "width: 100%; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;"

      const container = select.parentNode
      container.insertBefore(input, select)
      select.style.display = "none"
      input.focus()

      const saveNewType = async () => {
        const newType = input.value.trim()
        if (newType && !this.contactManager.availableTypes.includes(newType)) {
          this.contactManager.availableTypes.push(newType)
          await this.contactManager.saveAvailableTypes(this.spreadsheetId)
          this.contactManager.populateTypeDropdown()
          select.value = newType
          if (this.contactManager.currentContact) {
            await this.updateContactType(newType)
          }
          this.uiManager.showMessage(`✅ Type "${newType}" added!`, "success")
        }
        container.removeChild(input)
        select.style.display = "block"
        if (!newType) select.value = ""
      }

      input.addEventListener("blur", saveNewType)
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          saveNewType()
        }
        if (e.key === "Escape") {
          container.removeChild(input)
          select.style.display = "block"
          select.value = ""
        }
      })
    } else if (value && this.contactManager.currentContact) {
      await this.updateContactType(value)
    }
  }

  async updateContactType(type) {
    try {
      if (this.contactManager.currentContact) {
        const range = `Sheet1!T${this.contactManager.currentContact.rowIndex}`
        await this.sheetsAPI.updateCell(this.spreadsheetId, range, type)

        // Update local data
        if (this.contactManager.currentContact.data.length < 20) {
          this.contactManager.currentContact.data.push(type)
        } else {
          this.contactManager.currentContact.data[19] = type
        }
      }
    } catch (error) {
      console.error("Update contact type error:", error)
      this.uiManager.showMessage("Failed to update contact type.", "error")
    }
  }

  async handleClosedChange(event) {
    const isClosed = event.target.checked
    const contactName = this.contactManager.currentContact ? this.contactManager.currentContact.data[0] : "Contact"

    this.uiManager.updateContactNameDisplay(contactName, isClosed)

    try {
      await this.contactManager.updateClosedStatus(this.spreadsheetId, isClosed)
    } catch (error) {
      this.uiManager.showMessage("Failed to update closed status.", "error")
    }
  }

  async updateSequenceStep(step, completed) {
    try {
      await this.contactManager.updateSequenceStep(this.spreadsheetId, step, completed)
      this.uiManager.showMessage(`✅ ${step} step updated successfully!`, "success")
    } catch (error) {
      this.uiManager.showMessage(`Failed to update ${step}: ${error.message}`, "error")
    }
  }

  async saveCohort(silent = false) {
    const cohortInput = Utils.safeGetElement("cohort-input")
    if (!cohortInput) return

    const cohort = cohortInput.value.trim()

    try {
      this.currentCohort = cohort
      await chrome.storage.local.set({ currentCohort: cohort })

      if (this.contactManager.currentContact) {
        const range = `Sheet1!E${this.contactManager.currentContact.rowIndex}`
        await this.sheetsAPI.updateCell(this.spreadsheetId, range, cohort)
      }

      if (!silent) {
        this.uiManager.showMessage("✅ Cohort saved successfully!", "success")
      }
    } catch (error) {
      console.error("Save cohort error:", error)
      if (!silent) {
        this.uiManager.showMessage("Failed to save cohort.", "error")
      }
    }
  }

  async saveNotes(silent = false) {
    const notesInput = Utils.safeGetElement("notes-input")
    if (!notesInput) return

    const notes = notesInput.value.trim()

    try {
      if (this.contactManager.currentContact) {
        const range = `Sheet1!S${this.contactManager.currentContact.rowIndex}`
        await this.sheetsAPI.updateCell(this.spreadsheetId, range, notes)

        // Update local data
        if (this.contactManager.currentContact.data.length < 19) {
          this.contactManager.currentContact.data.push(notes)
        } else {
          this.contactManager.currentContact.data[18] = notes
        }
      }

      if (!silent) {
        this.uiManager.showMessage("✅ Notes saved successfully!", "success")
      }
    } catch (error) {
      console.error("Save notes error:", error)
      if (!silent) {
        this.uiManager.showMessage("Failed to save notes.", "error")
      }
    }
  }

  // Cache management methods
  async clearCache() {
    try {
      this.uiManager.showMessage("Clearing cache...", "success", 0)
      await chrome.storage.local.clear()

      this.spreadsheetId = null
      this.currentCohort = ""
      this.contactManager.currentContact = null
      this.contactManager.availableTypes = []
      this.sheetManager.savedSheets = []
      this.sheetManager.currentSheetId = null

      this.uiManager.showMessage("✅ Cache cleared successfully!", "success")

      if (this.authManager.isAuthenticated) {
        this.uiManager.showSection("setup")
      } else {
        this.uiManager.showSection("auth")
      }

      this.updateSheetUI()
      this.uiManager.closeSettings()
    } catch (error) {
      console.error("Clear cache error:", error)
      this.uiManager.showMessage("Failed to clear cache.", "error")
    }
  }

  async refreshConnection() {
    try {
      this.uiManager.showMessage("Refreshing connection...", "success", 0)

      const isValid = await this.authManager.testTokenValidity()
      if (!isValid) {
        const hasToken = await this.authManager.getAuthToken(false)
        if (!hasToken) {
          this.uiManager.showMessage("Authentication expired. Please sign in again.", "error")
          this.uiManager.updateAuthIndicator(false)
          this.uiManager.showSection("auth")
          return
        }
      }

      this.uiManager.updateAuthIndicator(true)

      if (this.spreadsheetId) {
        await this.sheetsAPI.testConnection(this.spreadsheetId)
        await this.contactManager.loadAvailableTypes(this.spreadsheetId)
        await this.contactManager.loadContactData(this.spreadsheetId, this.currentCohort)
        this.uiManager.showMessage("✅ Connection refreshed successfully!", "success")
      } else {
        this.uiManager.showSection("setup")
        this.uiManager.showMessage("✅ Ready to setup spreadsheet!", "success")
      }

      this.uiManager.closeSettings()
    } catch (error) {
      console.error("Refresh connection error:", error)
      this.uiManager.showMessage("Failed to refresh connection.", "error")
    }
  }

  async forceReauth() {
    try {
      this.uiManager.showMessage("Clearing authentication...", "success", 0)
      this.authManager.clearAuth()
      this.uiManager.updateAuthIndicator(false)
      this.uiManager.showSection("auth")
      this.uiManager.showMessage("Please sign in with Google again.", "success")
      this.uiManager.closeSettings()
    } catch (error) {
      console.error("Force reauth error:", error)
      this.uiManager.showMessage("Failed to clear authentication.", "error")
    }
  }

  async resetSetup() {
    this.authManager.clearAuth()
    await chrome.storage.local.clear()

    this.spreadsheetId = null
    this.currentCohort = ""
    this.contactManager.currentContact = null
    this.contactManager.availableTypes = []
    this.sheetManager.savedSheets = []
    this.sheetManager.currentSheetId = null

    this.uiManager.updateAuthIndicator(false)
    this.uiManager.showSection("auth")
    this.uiManager.showMessage("Setup reset. Please authenticate again.", "success")
    this.updateSheetUI()
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new LinkedInOutreachTracker()
})
