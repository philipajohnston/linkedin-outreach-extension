// Contact data management
import { CONFIG } from "./config.js"
import { Utils } from "./utils.js"
import { ProfileExtractor } from "./profile-extractor.js"
import { chrome } from "chrome"

export class ContactManager {
  constructor(sheetsAPI, uiManager) {
    this.sheetsAPI = sheetsAPI
    this.uiManager = uiManager
    this.currentContact = null
    this.availableTypes = []
  }

  // Helper to map a spreadsheet row array to a structured object
  mapRowToContact(rowArray, rowIndex) {
    const contact = { rowIndex }
    for (const key in CONFIG.COLUMN_MAPPING) {
      const index = CONFIG.COLUMN_MAPPING[key]
      contact[key.toLowerCase()] = rowArray[index] || ""
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
      console.log("Extracted profile data:", profileData)

      const existingRow = await this.sheetsAPI.findExistingContact(spreadsheetId, profileData.profileUrl)

      if (existingRow) {
        console.log("Found existing contact:", existingRow)
        this.currentContact = this.mapRowToContact(existingRow.data, existingRow.rowIndex)

        // Update job info if it's different
        if (
          (profileData.role && profileData.role !== this.currentContact.role_title) ||
          (profileData.company && profileData.company !== this.currentContact.company)
        ) {
          await this.updateContactJobInfo(spreadsheetId, profileData.role, profileData.company)
        }

        // Check and update connection acceptance status
        await this.checkAndUpdateAcceptanceStatus(spreadsheetId, profileData.isFirstDegreeConnection)
      } else {
        console.log("Creating new contact...")
        const newRow = await this.sheetsAPI.createNewContact(spreadsheetId, profileData, cohort)
        this.currentContact = this.mapRowToContact(newRow.data, newRow.rowIndex)

        // If it's already a 1st degree connection when we first add them, mark as accepted
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

      // If they're now a 1st degree connection but weren't marked as accepted before
      if (isFirstDegreeConnection && !currentlyAccepted) {
        console.log("Connection request has been accepted - updating status")
        await this.updateAcceptanceStatus(spreadsheetId, true)
        this.uiManager.showMessage("🎉 Connection request accepted!", "success", 3000)
      }
      // If they were marked as accepted but are no longer 1st degree (unlikely but possible)
      else if (!isFirstDegreeConnection && currentlyAccepted) {
        console.log("Connection status changed - no longer 1st degree")
        await this.updateAcceptanceStatus(spreadsheetId, false)
      }
    } catch (error) {
      console.error("Check acceptance status error:", error)
    }
  }

  async updateAcceptanceStatus(spreadsheetId, isAccepted) {
    try {
      if (!this.currentContact) return

      const rowIndex = this.currentContact.rowIndex
      const acceptedColumn = Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.ACCEPTED)
      const timestampColumn = Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.ACCEPTED_TIMESTAMP)

      const acceptedValue = isAccepted ? "TRUE" : ""
      const timestamp = isAccepted ? new Date().toISOString() : ""

      const range = `Sheet1!${acceptedColumn}${rowIndex}:${timestampColumn}${rowIndex}`
      await this.sheetsAPI.updateRange(spreadsheetId, range, [acceptedValue, timestamp])

      // Update local contact object
      this.currentContact.accepted = acceptedValue
      this.currentContact.accepted_timestamp = timestamp

      console.log(`Updated acceptance status: ${isAccepted ? "ACCEPTED" : "NOT ACCEPTED"}`)
    } catch (error) {
      console.error("Update acceptance status error:", error)
      throw error
    }
  }

  async updateContactJobInfo(spreadsheetId, role, company) {
    try {
      if (!this.currentContact) return
      const rowIndex = this.currentContact.rowIndex
      const updates = []
      if (company) {
        updates.push({
          range: `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.COMPANY)}${rowIndex}`,
          value: company,
        })
        this.currentContact.company = company
      }
      if (role) {
        updates.push({
          range: `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.ROLE_TITLE)}${rowIndex}`,
          value: role,
        })
        this.currentContact.role_title = role
      }
      // This part can be optimized to a single batch update call if needed
      for (const update of updates) {
        await this.sheetsAPI.updateCell(spreadsheetId, update.range, update.value)
      }
    } catch (error) {
      console.error("Update contact job info error:", error)
    }
  }

  async updateSequenceStep(spreadsheetId, step, completed) {
    try {
      const stepKey = step.toUpperCase()
      const stepIndex = CONFIG.COLUMN_MAPPING[stepKey]
      const timestampIndex = CONFIG.COLUMN_MAPPING[`${stepKey}_TIMESTAMP`]
      const timestamp = completed ? new Date().toISOString() : ""
      const stepValue = completed ? "TRUE" : ""

      const range = `Sheet1!${Utils.getColumnLetter(stepIndex)}${this.currentContact.rowIndex}:${Utils.getColumnLetter(timestampIndex)}${this.currentContact.rowIndex}`
      await this.sheetsAPI.updateRange(spreadsheetId, range, [stepValue, timestamp])

      this.uiManager.updateTimestampDisplay(step, timestamp)
      return true
    } catch (error) {
      console.error("Update sequence error:", error)
      throw error
    }
  }

  async updateClosedStatus(spreadsheetId, isClosed, reason = null) {
    try {
      if (!this.currentContact) return
      const rowIndex = this.currentContact.rowIndex
      const statusColumn = Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.STATUS)
      const notesColumn = Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.NOTES)
      const statusRange = `Sheet1!${statusColumn}${rowIndex}`
      const notesRange = `Sheet1!${notesColumn}${rowIndex}`

      const newStatus = isClosed ? "CLOSED" : "OPEN"
      let currentNotes = this.currentContact.notes || ""
      let newNotes = currentNotes

      if (isClosed) {
        // Prepend closure reason to notes
        const reasonText = `Closure Reason: ${reason || "Not specified"}`
        // Remove old reason if it exists
        currentNotes = currentNotes.replace(/^Closure Reason: .*\n---\n/, "")
        newNotes = `${reasonText}\n---\n${currentNotes}`
      } else {
        // Remove closure reason from notes
        newNotes = currentNotes.replace(/^Closure Reason: .*\n---\n/, "")
      }

      // Batch update status and notes in a single call for efficiency
      // Note: This requires columns to be adjacent or handled by multiple ranges in a batchUpdate call.
      // For simplicity, we do two separate calls, which is fine for this use case.
      await this.sheetsAPI.updateCell(spreadsheetId, statusRange, newStatus)
      await this.sheetsAPI.updateCell(spreadsheetId, notesRange, newNotes)

      // Update local contact object
      this.currentContact.status = newStatus
      this.currentContact.notes = newNotes

      this.uiManager.updateContactDisplayStatus(this.currentContact)
    } catch (error) {
      console.error("Update closed status error:", error)
      throw error
    }
  }

  async saveConnectionNote(spreadsheetId, noteText) {
    if (!this.currentContact) return
    try {
      const range = `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMN_MAPPING.CONNECTION_NOTE)}${this.currentContact.rowIndex}`
      await this.sheetsAPI.updateCell(spreadsheetId, range, noteText)
      this.currentContact.connection_note = noteText
      console.log("Successfully saved connection note to sheet.")
      this.uiManager.displayConnectionNote(noteText)
    } catch (error) {
      console.error("Failed to save connection note:", error)
      throw error
    }
  }

  // Type management can be simplified or refactored further if needed
  async loadAvailableTypes(spreadsheetId) {
    try {
      const stored = await chrome.storage.local.get([`types_${spreadsheetId}`])
      this.availableTypes = stored[`types_${spreadsheetId}`] || []
    } catch (error) {
      console.error("Load available types error:", error)
      this.availableTypes = []
    }
  }

  async saveAvailableTypes(spreadsheetId) {
    try {
      await chrome.storage.local.set({ [`types_${spreadsheetId}`]: this.availableTypes })
    } catch (error) {
      console.error("Save available types error:", error)
    }
  }
}
