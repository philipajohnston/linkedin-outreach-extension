// Contact data management
import { CONFIG } from "./config.js"
import { Utils } from "./utils.js"
import { ProfileExtractor } from "./profile-extractor.js"

export class ContactManager {
  constructor(sheetsAPI, uiManager) {
    this.sheetsAPI = sheetsAPI
    this.uiManager = uiManager
    this.currentContact = null
    this.availableTypes = []
  }

  mapRowToContact(rowArray, rowIndex) {
    const contact = { rowIndex }
    for (const key in CONFIG.COLUMN_MAPPING) {
      contact[key.toLowerCase()] = rowArray[CONFIG.COLUMN_MAPPING[key]] || ""
    }
    return contact
  }

  async loadContactData(spreadsheetId, cohort) {
    try {
      this.uiManager.showLoading()
      const profileData = await ProfileExtractor.extractProfileData()
      if (!profileData.name || !profileData.profileUrl) {
        throw new Error("Could not extract profile information from this page.")
      }

      const existingRow = await this.sheetsAPI.findExistingContact(spreadsheetId, profileData.profileUrl)

      if (existingRow) {
        this.currentContact = this.mapRowToContact(existingRow.data, existingRow.rowIndex)
        await this.updateContactJobInfo(spreadsheetId, profileData.role, profileData.company)
        await this.checkAndUpdateAcceptanceStatus(spreadsheetId, profileData.isFirstDegreeConnection)
      } else {
        const newRow = await this.sheetsAPI.createNewContact(spreadsheetId, profileData, cohort)
        this.currentContact = this.mapRowToContact(newRow.data, newRow.rowIndex)
        if (profileData.isFirstDegreeConnection) {
          await this.updateAcceptanceStatus(spreadsheetId, true)
        }
      }

      this.uiManager.displayContact(this.currentContact)
      this.uiManager.showSection("contact")
      this.uiManager.hideLoading()
      return this.currentContact
    } catch (error) {
      console.error("Load contact error:", error)
      this.uiManager.hideLoading()
      throw error
    }
  }

  async checkAndUpdateAcceptanceStatus(spreadsheetId, isFirstDegreeConnection) {
    try {
      const currentlyAccepted = this.currentContact.accepted === "TRUE"
      if (isFirstDegreeConnection && !currentlyAccepted) {
        await this.updateAcceptanceStatus(spreadsheetId, true)
        this.uiManager.showMessage("🎉 Connection request accepted!", "success", 3000)
      } else if (!isFirstDegreeConnection && currentlyAccepted) {
        await this.updateAcceptanceStatus(spreadsheetId, false)
      }
    } catch (error) {
      console.error("Check acceptance status error:", error)
    }
  }

  async updateAcceptanceStatus(spreadsheetId, isAccepted) {
    if (!this.currentContact) return
    const acceptedCol = Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.ACCEPTED)
    const timestampCol = Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.ACCEPTED_TIMESTAMP)
    const acceptedValue = isAccepted ? "TRUE" : ""
    const timestamp = isAccepted ? new Date().toISOString() : ""
    const range = `Sheet1!${acceptedCol}${this.currentContact.rowIndex}:${timestampCol}${this.currentContact.rowIndex}`
    await this.sheetsAPI.updateRange(spreadsheetId, range, [acceptedValue, timestamp])
    this.currentContact.accepted = acceptedValue
    this.currentContact.accepted_timestamp = timestamp
  }

  async updateContactJobInfo(spreadsheetId, role, company) {
    if (!this.currentContact) return
    const rowIndex = this.currentContact.rowIndex
    try {
      if (company && company !== this.currentContact.company) {
        await this.sheetsAPI.updateCell(spreadsheetId, `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.COMPANY)}${rowIndex}`, company)
        this.currentContact.company = company
      }
      if (role && role !== this.currentContact.role_title) {
        await this.sheetsAPI.updateCell(spreadsheetId, `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.ROLE_TITLE)}${rowIndex}`, role)
        this.currentContact.role_title = role
      }
    } catch (error) {
      console.error("Update job info error:", error)
    }
  }

  async updateSequenceStep(spreadsheetId, step, completed) {
    const stepKey = step.toUpperCase()
    const stepIndex = CONFIG.COLUMN_MAPPING[stepKey]
    const timestampIndex = CONFIG.COLUMN_MAPPING[`${stepKey}_TIMESTAMP`]

    if (stepIndex === undefined || timestampIndex === undefined) {
      console.error(`Invalid step: ${step}`)
      return false
    }

    const timestamp = completed ? new Date().toISOString() : ""
    const stepValue = completed ? "TRUE" : ""
    const range = `Sheet1!${Utils.getColumnLetter(stepIndex)}${this.currentContact.rowIndex}:${Utils.getColumnLetter(timestampIndex)}${this.currentContact.rowIndex}`
    await this.sheetsAPI.updateRange(spreadsheetId, range, [stepValue, timestamp])
    this.uiManager.updateTimestampDisplay(step, timestamp)
    return true
  }

  async updateClosedStatus(spreadsheetId, isClosed, reason = null) {
    if (!this.currentContact) return
    const rowIndex = this.currentContact.rowIndex
    const statusRange = `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.STATUS)}${rowIndex}`
    const notesRange = `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.NOTES)}${rowIndex}`

    const newStatus = isClosed ? "CLOSED" : "OPEN"
    let newNotes = (this.currentContact.notes || "").replace(/^Closure Reason:.*?\s*\|\|\s*/i, "")
    if (isClosed) newNotes = `Closure Reason: ${reason || "Not specified"} || ${newNotes}`

    await this.sheetsAPI.updateCell(spreadsheetId, statusRange, newStatus)
    await this.sheetsAPI.updateCell(spreadsheetId, notesRange, newNotes)
    this.currentContact.status = newStatus
    this.currentContact.notes = newNotes
    this.uiManager.updateContactDisplayStatus(this.currentContact)
  }

  async saveConnectionNote(spreadsheetId, noteText) {
    if (!this.currentContact) return
    const range = `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.CONNECTION_NOTE)}${this.currentContact.rowIndex}`
    await this.sheetsAPI.updateCell(spreadsheetId, range, noteText)
    this.currentContact.connection_note = noteText
    this.uiManager.displayConnectionNote(noteText)
  }

  async loadAvailableTypes(spreadsheetId) {
    try {
      const stored = await chrome.storage.local.get([`types_${spreadsheetId}`])
      this.availableTypes = stored[`types_${spreadsheetId}`] || []
    } catch (error) {
      this.availableTypes = []
    }
  }

  async saveAvailableTypes(spreadsheetId) {
    await chrome.storage.local.set({ [`types_${spreadsheetId}`]: this.availableTypes })
  }

  populateTypeDropdown() {
    const select = Utils.safeGetElement("type-select")
    if (!select) return
    select.innerHTML = '<option value="">Select type...</option>'
    this.availableTypes.forEach((type) => {
      const option = document.createElement("option")
      option.value = type
      option.textContent = type
      select.appendChild(option)
    })
    const addNew = document.createElement("option")
    addNew.value = "add-new"
    addNew.textContent = "➕ Add new type..."
    addNew.style.cssText = "font-style: italic; color: #666"
    select.appendChild(addNew)
  }
}
