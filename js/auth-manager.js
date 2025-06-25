// Authentication management
export class AuthManager {
  constructor() {
    this.accessToken = null
    this.isAuthenticated = false
  }

  async getAuthToken(interactive = false) {
    return new Promise((resolve) => {
      console.log(`Getting auth token (interactive: ${interactive})...`)

      chrome.identity.getAuthToken({ interactive: false }, (cachedToken) => {
        if (cachedToken && !chrome.runtime.lastError) {
          console.log("Using cached token:", cachedToken.substring(0, 20) + "...")
          this.accessToken = cachedToken
          this.isAuthenticated = true
          resolve(true)
          return
        }

        if (!interactive) {
          console.log("No cached token available")
          this.accessToken = null
          this.isAuthenticated = false
          resolve(false)
          return
        }

        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            console.log("Auth error:", chrome.runtime.lastError.message)
            this.accessToken = null
            this.isAuthenticated = false
            resolve(false)
          } else if (token) {
            console.log("Got new auth token:", token.substring(0, 20) + "...")
            this.accessToken = token
            this.isAuthenticated = true
            resolve(true)
          } else {
            console.log("No token received")
            this.accessToken = null
            this.isAuthenticated = false
            resolve(false)
          }
        })
      })
    })
  }

  async testTokenValidity() {
    try {
      console.log("Testing token validity...")
      const response = await fetch("https://www.googleapis.com/oauth2/v1/tokeninfo", {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })

      const result = await response.json()
      console.log("Token info:", result)

      if (!response.ok) {
        throw new Error("Token is invalid")
      }
      return true
    } catch (error) {
      console.error("Token validation failed:", error)
      this.accessToken = null
      this.isAuthenticated = false
      return false
    }
  }

  clearAuth() {
    if (this.accessToken) {
      chrome.identity.removeCachedAuthToken({ token: this.accessToken })
    }
    this.accessToken = null
    this.isAuthenticated = false
  }

  async makeAuthenticatedRequest(url, options = {}) {
    console.log(`Making authenticated request to: ${url}`)

    if (!this.accessToken || !this.isAuthenticated) {
      console.log("No access token, attempting to authenticate...")
      const success = await this.getAuthToken(true)
      if (!success) {
        throw new Error("Authentication required. Please sign in with Google first.")
      }
    }

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    }

    const response = await fetch(url, { ...options, headers })
    console.log("Response status:", response.status)

    if (response.status === 401) {
      console.log("Token expired, refreshing...")
      chrome.identity.removeCachedAuthToken({ token: this.accessToken })
      const success = await this.getAuthToken(true)
      if (success) {
        headers["Authorization"] = `Bearer ${this.accessToken}`
        return fetch(url, { ...options, headers })
      } else {
        throw new Error("Failed to refresh authentication token")
      }
    }

    return response
  }
}
