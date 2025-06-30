// Application configuration constants
export const CONFIG = {
  SPREADSHEET_HEADERS: [
    "Name",
    "LinkedIn Profile URL",
    "Company",
    "Role/Title",
    "Cohort",
    "Warmup",
    "Warmup Timestamp",
    "Connect",
    "Connect Timestamp",
    "Connection Note", // New column for connection note
    "Chatting",
    "Chatting Timestamp",
    "CTA",
    "CTA Timestamp",
    "Interest",
    "Interest Timestamp",
    "Converted",
    "Converted Timestamp",
    "Date Added",
    "Notes",
    "Type",
    "Closed",
    "Closure Reason",
  ],
  SEQUENCE_STEPS: ["warmup", "connect", "chatting", "cta", "interest", "converted"],
  URL_PATTERNS: [/spreadsheets\/d\/([a-zA-Z0-9_-]+)\/edit/, /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/],
  SPREADSHEET_ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DEBOUNCE_DELAY: 500, // milliseconds
}
