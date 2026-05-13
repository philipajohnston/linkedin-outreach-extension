// Application configuration constants

const SPREADSHEET_HEADERS = [
  "Status", // New first column
  "Name",
  "LinkedIn Profile URL",
  "Company",
  "Role/Title",
  "Cohort",
  "Warmup",
  "Warmup Timestamp",
  "Connect",
  "Connect Timestamp",
  "Connection Note",
  "Accepted", // New field for connection acceptance
  "Accepted Timestamp", // New field for when connection was accepted
  "Chatting",
  "Chatting Timestamp",
  "CTA",
  "CTA Timestamp",
  "Interest",
  "Interest Timestamp",
  "Converted",
  "Converted Timestamp",
  "Date Added",
  "Notes", // Notes and Closure Reason are combined here
  "Type",
]

// Dynamically generate a mapping of column names to their index
// This makes the code resilient to column reordering
const COLUMN_MAPPING = SPREADSHEET_HEADERS.reduce((acc, header, index) => {
  const key = header.replace(/[\s/]+/g, "_").toUpperCase() // e.g., "LinkedIn Profile URL" -> "LINKEDIN_PROFILE_URL", "Role/Title" -> "ROLE_TITLE"
  acc[key] = index
  return acc
}, {})

export const CONFIG = {
  SPREADSHEET_HEADERS,
  COLUMN_MAPPING,
  SEQUENCE_STEPS: ["warmup", "connect", "chatting", "cta", "interest", "converted"],
  URL_PATTERNS: [/spreadsheets\/d\/([a-zA-Z0-9_-]+)\/edit/, /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/],
  SPREADSHEET_ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DEBOUNCE_DELAY: 500, // milliseconds
}
