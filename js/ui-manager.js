// UI state and element management
import { Utils } from "./utils.js"

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
        if (section === sectionName) {
          element.classList.remove("hidden")
        } else {
          element.classList.add("hidden")
        }
      }
    })
  }

  showLoading() {
    const loading = Utils.safeGetElement("loading")
    if (loading) loading.classList.remove("hidden")
  }

  hideLoading() {
    const loading = Utils.safeGetElement("loading")
    if (loading) loading.classList.add("hidden")
  }

  showMessage(text, type, timeout = 2000) {
    const messageEl = Utils.safeGetElement("message")
    if (messageEl) {
      messageEl.textContent = text
      messageEl.className = `message ${type}`
      messageEl.classList.remove("hidden")

      if (this.messageTimeout) {
        clearTimeout(this.messageTimeout)
      }

      if (timeout > 0) {
        this.messageTimeout = setTimeout(() => this.hideMessage(), timeout)
      }
    }
  }

  hideMessage() {
    const messageEl = Utils.safeGetElement("message")
    if (messageEl) messageEl.classList.add("hidden")
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout)
      this.messageTimeout = null
    }
  }

  updateAuthIndicator(isAuthenticated) {
    const indicator = Utils.safeGetElement("auth-indicator")
    const icon = Utils.safeGetElement("auth-icon")
    const text = Utils.safeGetElement("auth-text")

    if (indicator && icon && text) {
      if (isAuthenticated) {
        indicator.className = "auth-indicator authenticated"
        icon.textContent = "✅"
        text.textContent = "Authenticated"
      } else {
        indicator.className = "auth-indicator unauthenticated"
        icon.textContent = "❌"
        text.textContent = "Not authenticated"
      }
    }
  }

  toggleSettings() {
    const toggle = Utils.safeGetElement("settings-toggle")
    const panel = Utils.safeGetElement("settings-panel")

    if (panel && toggle) {
      if (panel.classList.contains("show")) {
        panel.classList.remove("show")
        toggle.classList.remove("active")
      } else {
        panel.classList.add("show")
        toggle.classList.add("active")
      }
    }
  }

  closeSettings() {
    const panel = Utils.safeGetElement("settings-panel")
    const toggle = Utils.safeGetElement("settings-toggle")
    if (panel) panel.classList.remove("show")
    if (toggle) toggle.classList.remove("active")
  }

  updateContactNameDisplay(name, isClosed) {
    const nameEl = Utils.safeGetElement("contact-name")
    if (nameEl) {
      if (isClosed) {
        nameEl.innerHTML = `${name} <span style="color: #dc2626; font-weight: 600; font-size: 14px;">(CLOSED)</span>`
      } else {
        nameEl.textContent = name
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
      if (sheet.id === currentSheetId) {
        option.selected = true
      }
      select.appendChild(option)
    })

    const addNewOption = document.createElement("option")
    addNewOption.value = "add-new"
    addNewOption.textContent = "➕ Add new sheet..."
    addNewOption.style.fontStyle = "italic"
    addNewOption.style.color = "#666"
    select.appendChild(addNewOption)
  }

  updateCurrentSheetDisplay(sheetName) {
    const display = Utils.safeGetElement("current-sheet-name")
    if (display) {
      display.textContent = sheetName || "No sheet selected"
    }
  }
}
