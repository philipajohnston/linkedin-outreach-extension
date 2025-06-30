// Contact data management
import { CONFIG as APP_CONFIG } from "./config.js"
import { Utils } from "./utils.js"
import { ProfileExtractor } from "./profile-extractor.js"
//import { chrome } from "chrome" // Declared the chrome variable

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

      console.log("Extracted profile data:", profileData)

      const existingContact = await this.sheetsAPI.findExistingContact(spreadsheetId, profileData.profileUrl)

      if (existingContact) {
        console.log("Found existing contact:", existingContact)
        this.currentContact = existingContact

        // Update existing contact with new role/company data if available
        if (profileData.role || profileData.company) {
          await this.updateContactJobInfo(spreadsheetId, profileData.role, profileData.company)
        }

        this.displayExistingContact(profileData, existingContact)
      } else {
        console.log("Creating new contact...")
        const newContact = await this.sheetsAPI.createNewContact(spreadsheetId, profileData, cohort)
        console.log("Created new contact:", newContact)
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
    try {
      if (this.currentContact) {
        // Update company (column C)
        if (company) {
          const companyRange = `Sheet1!C${this.currentContact.rowIndex}`
          await this.sheetsAPI.updateCell(spreadsheetId, companyRange, company)
          this.currentContact.data[2] = company
        }

        // Update role (column D)
        if (role) {
          const roleRange = `Sheet1!D${this.currentContact.rowIndex}`
          await this.sheetsAPI.updateCell(spreadsheetId, roleRange, role)
          this.currentContact.data[3] = role
        }
      }
    } catch (error) {
      console.error("Update contact job info error:", error)
    }
  }

  displayNewContact(profileData, cohort = "") {
    const contactName = Utils.safeGetElement("contact-name")
    const contactUrl = Utils.safeGetElement("contact-url")
    const statusEl = Utils.safeGetElement("contact-status")
    const cohortInput = Utils.safeGetElement("cohort-input")
    const notesInput = Utils.safeGetElement("notes-input")
    const closedCheckbox = Utils.safeGetElement("closed-checkbox")

    if (contactName) {
      contactName.innerHTML = `
        <div>${profileData.name}</div>
        ${profileData.role ? `<div style="font-size: 14px; font-weight: 500; color: #6b7280; margin-top: 2px;">${profileData.role}</div>` : ""}
        ${profileData.company ? `<div style="font-size: 12px; font-weight: 400; color: #9ca3af; margin-top: 1px;">${profileData.company}</div>` : ""}
      `
    }

    if (contactUrl) {
      contactUrl.href = profileData.profileUrl
      contactUrl.textContent = profileData.profileUrl
    }
    if (statusEl) {
      statusEl.textContent = "New Contact"
      statusEl.className = "contact-status status-new"
    }

    // Populate form fields
    if (cohortInput) cohortInput.value = cohort
    if (notesInput) notesInput.value = ""
    if (closedCheckbox) closedCheckbox.checked = false

    this.renderSequenceGrid({})
    this.displayConnectionNote("")
  }

  displayExistingContact(profileData, existingContact) {
    const contactName = Utils.safeGetElement("contact-name")
    const contactUrl = Utils.safeGetElement("contact-url")

    if (contactName) {
      const company = existingContact.data[2] || profileData.company || ""
      const role = existingContact.data[3] || profileData.role || ""

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

    // Set closure status
    const isClosed = existingContact.data[20] === "TRUE"
    const closedCheckbox = Utils.safeGetElement("closed-checkbox")
    if (closedCheckbox) closedCheckbox.checked = isClosed

    this.uiManager.updateContactNameDisplay(profileData.name, isClosed)

    const sequenceData = {}
    APP_CONFIG.SEQUENCE_STEPS.forEach((step, index) => {
      const stepIndex = 5 + index * 2
      const timestampIndex = stepIndex + 1
      sequenceData[step] = {
        completed: existingContact.data[stepIndex] === "TRUE",
        timestamp: existingContact.data[timestampIndex] || "",
      }
    })

    this.renderSequenceGrid(sequenceData)

    const connectionNote = existingContact.data[9] || ""
    this.displayConnectionNote(connectionNote)
  }

  renderSequenceGrid(sequenceData) {
    const grid = Utils.safeGetElement("sequence-grid")
    if (!grid) return

    grid.innerHTML = ""

    APP_CONFIG.SEQUENCE_STEPS.forEach((step) => {
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

      if (sequenceData[step]?.timestamp) {
        const date = new Date(sequenceData[step].timestamp)
        timestamp.textContent =
          date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }

      labelDiv.appendChild(label)
      labelDiv.appendChild(timestamp)
      item.appendChild(checkbox)
      item.appendChild(labelDiv)
      grid.appendChild(item)
    })
  }

  async updateSequenceStep(spreadsheetId, step, completed) {
    try {
      const stepIndex = 5 + APP_CONFIG.SEQUENCE_STEPS.indexOf(step) * 2
      const timestampIndex = stepIndex + 1
      const timestamp = completed ? new Date().toISOString() : ""
      const stepValue = completed ? "TRUE" : ""

      const range = `Sheet1!${Utils.getColumnLetter(stepIndex)}${this.currentContact.rowIndex}:${Utils.getColumnLetter(timestampIndex)}${this.currentContact.rowIndex}`

      await this.sheetsAPI.updateRange(spreadsheetId, range, [stepValue, timestamp])

      const timestampEl = Utils.safeGetElement(`timestamp-${step}`)
      if (timestampEl) {
        if (completed && timestamp) {
          const date = new Date(timestamp)
          timestampEl.textContent =
            date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        } else {
          timestampEl.textContent = ""
        }
      }

      return true
    } catch (error) {
      console.error("Update sequence error:", error)
      throw error
    }
  }

  async updateClosedStatus(spreadsheetId, isClosed) {
    try {
      if (this.currentContact) {
        const range = `Sheet1!U${this.currentContact.rowIndex}`
        const closedValue = isClosed ? "TRUE" : ""

        await this.sheetsAPI.updateCell(spreadsheetId, range, closedValue)

        if (this.currentContact.data.length < 21) {
          this.currentContact.data.push(closedValue)
        } else {
          this.currentContact.data[20] = closedValue
        }
      }
    } catch (error) {
      console.error("Update closed status error:", error)
      throw error
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

  async saveConnectionNote(spreadsheetId, noteText) {
    if (!this.currentContact) {
      console.log("Cannot save connection note, no current contact.")
      return
    }
    try {
      await this.sheetsAPI.updateConnectionNote(spreadsheetId, this.currentContact.rowIndex, noteText)
      // Update local data
      this.currentContact.data[9] = noteText // Index 9 is the new "Connection Note"
      console.log("Successfully saved connection note to sheet.")
      this.displayConnectionNote(noteText) // Update UI
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
}
