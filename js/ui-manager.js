// UI state and element management
import { Utils } from "./utils.js"
import { CONFIG } from "./config.js"

export class UIManager {
  constructor() {
    this.messageTimeout = null
  }

  showSection(sectionName) {
    console.log(`Showing ${sectionName} section`)
    const sections = ["auth", "setup", "contact"]
    sections.forEach((section) => {
      const element = Utils.safeGetElement(`${section}-section`)
      if (element) {
        element.classList.toggle("hidden", section !== sectionName)
      }
    })
  }

  showLoading() {
    Utils.safeGetElement("loading")?.classList.remove("hidden")
  }

  hideLoading() {
    Utils.safeGetElement("loading")?.classList.add("hidden")
  }

  showMessage(text, type, timeout = 2000) {
    const messageEl = Utils.safeGetElement("message")
    if (!messageEl) return

    messageEl.textContent = text
    messageEl.className = `message ${type}`
    messageEl.classList.remove("hidden")

    if (this.messageTimeout) clearTimeout(this.messageTimeout)
    if (timeout > 0) {
      this.messageTimeout = setTimeout(() => this.hideMessage(), timeout)
    }
  }

  hideMessage() {
    Utils.safeGetElement("message")?.classList.add("hidden")
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout)
      this.messageTimeout = null
    }
  }

  updateAuthIndicator(isAuthenticated) {
    const indicator = Utils.safeGetElement("auth-indicator")
    const icon = Utils.safeGetElement("auth-icon")
    const text = Utils.safeGetElement("auth-text")
    if (!indicator || !icon || !text) return

    indicator.className = `auth-indicator ${isAuthenticated ? "authenticated" : "unauthenticated"}`
    icon.textContent = isAuthenticated ? "✅" : "❌"
    text.textContent = isAuthenticated ? "Authenticated" : "Not authenticated"
  }

  toggleSettings() {
    Utils.safeGetElement("settings-panel")?.classList.toggle("show")
    Utils.safeGetElement("settings-toggle")?.classList.toggle("active")
  }

  closeSettings() {
    Utils.safeGetElement("settings-panel")?.classList.remove("show")
    Utils.safeGetElement("settings-toggle")?.classList.remove("active")
  }

  displayContact(contact) {
    this.updateContactDisplayStatus(contact)

    const contactUrl = Utils.safeGetElement("contact-url")
    if (contactUrl) {
      contactUrl.href = contact.linkedin_profile_url
      contactUrl.textContent = contact.linkedin_profile_url
    }

    Utils.safeGetElement("cohort-input").value = contact.cohort
    Utils.safeGetElement("notes-input").value = contact.notes
    Utils.safeGetElement("type-select").value = contact.type

    this.renderSequenceGrid(contact)
    this.displayConnectionNote(contact.connection_note)
  }

  updateContactDisplayStatus(contact) {
    const nameEl = Utils.safeGetElement("contact-name")
    const statusEl = Utils.safeGetElement("contact-status")
    const closedCheckbox = Utils.safeGetElement("closed-checkbox")
    const isClosed = contact.status === "CLOSED"

    if (nameEl) {
      nameEl.innerHTML = `
        <div>${contact.name}</div>
        ${contact.role_title ? `<div style="font-size: 14px; font-weight: 500; color: #6b7280; margin-top: 2px;">${contact.role_title}</div>` : ""}
        ${contact.company ? `<div style="font-size: 12px; font-weight: 400; color: #9ca3af; margin-top: 1px;">${contact.company}</div>` : ""}
      `
    }

    if (statusEl) {
      statusEl.textContent = isClosed ? "Status: Closed" : "Status: Open"
      statusEl.className = `contact-status ${isClosed ? "status-closed" : "status-open"}`
    }

    if (closedCheckbox) {
      closedCheckbox.checked = isClosed
    }
  }

  renderSequenceGrid(contact) {
    const grid = Utils.safeGetElement("sequence-grid")
    if (!grid) return
    grid.innerHTML = ""

    CONFIG.SEQUENCE_STEPS.forEach((step) => {
      const stepKey = step.toUpperCase()
      const isCompleted = contact[step.toLowerCase()] === "TRUE"
      const timestamp = contact[`${step.toLowerCase()}_timestamp`]

      const item = document.createElement("div")
      item.className = "sequence-item"
      item.innerHTML = `
        <input type="checkbox" id="seq-${step}" ${isCompleted ? "checked" : ""}>
        <div style="flex: 1;">
          <div class="sequence-label">${step}</div>
          <div class="sequence-timestamp" id="timestamp-${step}"></div>
        </div>
      `
      grid.appendChild(item)
      this.updateTimestampDisplay(step, timestamp)
    })
  }

  updateTimestampDisplay(step, timestamp) {
    const timestampEl = Utils.safeGetElement(`timestamp-${step}`)
    if (timestampEl) {
      if (timestamp) {
        const date = new Date(timestamp)
        timestampEl.textContent =
          date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      } else {
        timestampEl.textContent = ""
      }
    }
  }

  displayConnectionNote(noteText) {
    const noteDisplay = Utils.safeGetElement("connection-note-display")
    if (noteDisplay) {
      const noteContent = noteDisplay.querySelector("p")
      if (noteText) {
        noteContent.textContent = noteText
        noteDisplay.classList.remove("hidden")
      } else {
        noteContent.textContent = "No note captured."
        noteDisplay.classList.add("hidden")
      }
    }
  }

  populateSheetSelector(sheets, currentSheetId) {
    const select = Utils.safeGetElement("sheet-selector")
    if (!select) return
    select.innerHTML = '<option value="">Select sheet...</option>'
    sheets.forEach((sheet) => {
      const option = document.createElement("option")
      option.value = sheet.id
      option.textContent = sheet.name
      option.selected = sheet.id === currentSheetId
      select.appendChild(option)
    })
    select.innerHTML += '<option value="add-new" style="font-style: italic; color: #666;">➕ Add new sheet...</option>'
  }

  updateCurrentSheetDisplay(sheetName) {
    const display = Utils.safeGetElement("current-sheet-name")
    if (display) {
      display.textContent = sheetName || "No sheet selected"
    }
  }
}
