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

  async loadContactData(spreadsheetId, cohort) {
    try {
      this.uiManager.showLoading()

      const profileData = await ProfileExtractor.extractProfileData()
      if (!profileData.name || !profileData.profileUrl) {
        throw new Error("Could not extract profile information from this page.")
      }

      const existingContact = await this.sheetsAPI.findExistingContact(spreadsheetId, profileData.profileUrl)

      if (existingContact) {
        this.currentContact = existingContact
        await this.updateContactJobInfo(spreadsheetId, profileData.role, profileData.company)
        this.displayExistingContact(profileData, existingContact)
      } else {
        const newContact = await this.sheetsAPI.createNewContact(spreadsheetId, profileData, cohort)
        this.currentContact = newContact
        this.displayNewContact(profileData, cohort)
      }

      this.uiManager.showSection("contact")
      this.uiManager.hideLoading()
      return this.currentContact
    } catch (error) {
      console.error("Load contact error:", error)
      this.uiManager.hideLoading()
      throw error
    }
  }

  async updateContactJobInfo(spreadsheetId, role, company) {
    if (!this.currentContact) return

    try {
      const updates = []
      if (company) {
        const companyRange = `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMNS.COMPANY)}${this.currentContact.rowIndex}`
        updates.push(this.sheetsAPI.updateCell(spreadsheetId, companyRange, company))
        this.currentContact.data[CONFIG.COLUMNS.COMPANY] = company
      }

      if (role) {
        const roleRange = `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMNS.ROLE)}${this.currentContact.rowIndex}`
        updates.push(this.sheetsAPI.updateCell(spreadsheetId, roleRange, role))
        this.currentContact.data[CONFIG.COLUMNS.ROLE] = role
      }

      await Promise.all(updates)
    } catch (error) {
      console.error("Update contact job info error:", error)
    }
  }

  displayNewContact(profileData, cohort = "") {
    this.updateContactDisplay(profileData, false)
    this.populateFormFields(cohort, "", false)
    this.renderSequenceGrid({})
    this.displayConnectionNote("")
  }

  displayExistingContact(profileData, existingContact) {
    const isClosed = existingContact.data[CONFIG.COLUMNS.STATUS] === "CLOSED"
    this.updateContactDisplay(profileData, isClosed)

    const cohort = existingContact.data[CONFIG.COLUMNS.COHORT] || ""
    const notes = existingContact.data[CONFIG.COLUMNS.NOTES] || ""
    this.populateFormFields(cohort, notes, isClosed)

    const sequenceData = this.buildSequenceData(existingContact.data)
    this.renderSequenceGrid(sequenceData)

    const connectionNote = existingContact.data[CONFIG.COLUMNS.CONNECTION_NOTE] || ""
    this.displayConnectionNote(connectionNote)
  }

  updateContactDisplay(profileData, isClosed) {
    const contactName = Utils.safeGetElement("contact-name")
    const contactUrl = Utils.safeGetElement("contact-url")
    const statusEl = Utils.safeGetElement("contact-status")

    if (contactName) {
      const company = profileData.company || this.currentContact?.data[CONFIG.COLUMNS.COMPANY] || ""
      const role = profileData.role || this.currentContact?.data[CONFIG.COLUMNS.ROLE] || ""

      contactName.innerHTML = `
        <div>${profileData.name}</div>
        ${role ? `<div style="font-size: 14px; font-weight: 500; color: #6b7280; margin-top: 2px;">${role}</div>` : ""}
        ${company ? `<div style="font-size: 12px; font-weight: 400; color: #9ca3af; margin-top: 1px;">${company}</div>` : ""}
      `
    }

    if (contactUrl) {
      contactUrl.href = profileData.profileUrl
      contactUrl.textContent = profileData.profileUrl
    }

    if (statusEl) {
      if (isClosed) {
        statusEl.textContent = "Closed Contact"
        statusEl.className = "contact-status status-closed"
      } else if (this.currentContact?.data[CONFIG.COLUMNS.NAME]) {
        statusEl.textContent = "Existing Contact"
        statusEl.className = "contact-status status-existing"
      } else {
        statusEl.textContent = "New Contact"
        statusEl.className = "contact-status status-new"
      }
    }

    this.uiManager.updateContactNameDisplay(profileData.name, isClosed)
  }

  populateFormFields(cohort, notes, isClosed) {
    const cohortInput = Utils.safeGetElement("cohort-input")
    const notesInput = Utils.safeGetElement("notes-input")
    const statusCheckbox = Utils.safeGetElement("status-checkbox")

    if (cohortInput) cohortInput.value = cohort
    if (notesInput) notesInput.value = notes
    if (statusCheckbox) statusCheckbox.checked = isClosed
  }

  buildSequenceData(contactData) {
    const sequenceData = {}
    CONFIG.SEQUENCE_STEPS.forEach((step, index) => {
      const stepColumn = CONFIG.COLUMNS.WARMUP + index * 2
      const timestampColumn = stepColumn + 1
      sequenceData[step] = {
        completed: contactData[stepColumn] === "TRUE",
        timestamp: contactData[timestampColumn] || "",
      }
    })
    return sequenceData
  }

  renderSequenceGrid(sequenceData) {
    const grid = Utils.safeGetElement("sequence-grid")
    if (!grid) return

    grid.innerHTML = ""

    CONFIG.SEQUENCE_STEPS.forEach((step) => {
      const item = document.createElement("div")
      item.className = "sequence-item"

      const checkbox = document.createElement("input")
      checkbox.type = "checkbox"
      checkbox.id = `seq-${step}`
      checkbox.checked = sequenceData[step]?.completed || false

      const labelDiv = document.createElement("div")
      labelDiv.style.flex = "1"

      const label = document.createElement("div")
      label.className = "sequence-label"
      label.textContent = step

      const timestamp = document.createElement("div")
      timestamp.className = "sequence-timestamp"
      timestamp.id = `timestamp-${step}`
      timestamp.textContent = Utils.formatTimestamp(sequenceData[step]?.timestamp)

      labelDiv.appendChild(label)
      labelDiv.appendChild(timestamp)
      item.appendChild(checkbox)
      item.appendChild(labelDiv)
      grid.appendChild(item)
    })
  }

  async updateSequenceStep(spreadsheetId, step, completed) {
    if (!this.currentContact) return

    try {
      const stepIndex = CONFIG.SEQUENCE_STEPS.indexOf(step)
      const stepColumn = CONFIG.COLUMNS.WARMUP + stepIndex * 2
      const timestampColumn = stepColumn + 1

      const timestamp = completed ? new Date().toISOString() : ""
      const stepValue = completed ? "TRUE" : ""

      const stepRange = `Sheet1!${Utils.getColumnLetter(stepColumn)}${this.currentContact.rowIndex}`
      const timestampRange = `Sheet1!${Utils.getColumnLetter(timestampColumn)}${this.currentContact.rowIndex}`

      await Promise.all([
        this.sheetsAPI.updateCell(spreadsheetId, stepRange, stepValue),
        this.sheetsAPI.updateCell(spreadsheetId, timestampRange, timestamp),
      ])

      // Update local data
      this.currentContact.data[stepColumn] = stepValue
      this.currentContact.data[timestampColumn] = timestamp

      // Update UI
      const timestampEl = Utils.safeGetElement(`timestamp-${step}`)
      if (timestampEl) {
        timestampEl.textContent = Utils.formatTimestamp(timestamp)
      }

      return true
    } catch (error) {
      console.error("Update sequence error:", error)
      throw error
    }
  }

  async updateStatus(spreadsheetId, isClosed) {
    if (!this.currentContact) return

    try {
      const range = `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMNS.STATUS)}${this.currentContact.rowIndex}`
      const statusValue = isClosed ? "CLOSED" : ""

      await this.sheetsAPI.updateCell(spreadsheetId, range, statusValue)
      this.currentContact.data[CONFIG.COLUMNS.STATUS] = statusValue
    } catch (error) {
      console.error("Update status error:", error)
      throw error
    }
  }

  async saveConnectionNote(spreadsheetId, noteText) {
    if (!this.currentContact) return

    try {
      const range = `Sheet1!${Utils.getColumnLetter(CONFIG.COLUMNS.CONNECTION_NOTE)}${this.currentContact.rowIndex}`
      await this.sheetsAPI.updateCell(spreadsheetId, range, noteText)
      this.currentContact.data[CONFIG.COLUMNS.CONNECTION_NOTE] = noteText
      this.displayConnectionNote(noteText)
    } catch (error) {
      console.error("Failed to save connection note:", error)
      throw error
    }
  }

  displayConnectionNote(noteText) {
    const noteDisplay = Utils.safeGetElement("connection-note-display")
    if (noteDisplay) {
      if (noteText) {
        noteDisplay.querySelector("p").textContent = noteText
        noteDisplay.classList.remove("hidden")
      } else {
        noteDisplay.classList.add("hidden")
      }
    }
  }

  async loadAvailableTypes(spreadsheetId) {
    try {
      const storageKey = `types_${spreadsheetId}`
      const stored = await chrome.storage.local.get([storageKey])
      this.availableTypes = stored[storageKey] || []
    } catch (error) {
      console.error("Load available types error:", error)
      this.availableTypes = []
    }
  }

  async saveAvailableTypes(spreadsheetId) {
    try {
      const storageKey = `types_${spreadsheetId}`
      await chrome.storage.local.set({ [storageKey]: this.availableTypes })
    } catch (error) {
      console.error("Save available types error:", error)
    }
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

    const addNewOption = document.createElement("option")
    addNewOption.value = "add-new"
    addNewOption.textContent = "➕ Add new type..."
    addNewOption.style.fontStyle = "italic"
    addNewOption.style.color = "#666"
    select.appendChild(addNewOption)
  }
}
