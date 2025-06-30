// Application configuration constants
export const CONFIG = {
  SPREADSHEET_HEADERS: [
    "Status", // A: Status (formerly Closed)
    "Name", // B: Name
    "LinkedIn Profile URL", // C: LinkedIn Profile URL
    "Company", // D: Company
    "Role/Title", // E: Role/Title
    "Cohort", // F: Cohort
    "Warmup", // G: Warmup
    "Warmup Timestamp", // H: Warmup Timestamp
    "Connect", // I: Connect
    "Connect Timestamp", // J: Connect Timestamp
    "Connection Note", // K: Connection Note
    "Chatting", // L: Chatting
    "Chatting Timestamp", // M: Chatting Timestamp
    "CTA", // N: CTA
    "CTA Timestamp", // O: CTA Timestamp
    "Interest", // P: Interest
    "Interest Timestamp", // Q: Interest Timestamp
    "Converted", // R: Converted
    "Converted Timestamp", // S: Converted Timestamp
    "Date Added", // T: Date Added
    "Notes", // U: Notes (includes former Closure Reason)
    "Type", // V: Type
  ],
  SEQUENCE_STEPS: ["warmup", "connect", "chatting", "cta", "interest", "converted"],
  URL_PATTERNS: [/spreadsheets\/d\/([a-zA-Z0-9_-]+)\/edit/, /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/],
  SPREADSHEET_ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DEBOUNCE_DELAY: 500,

  // Column mappings for easy reference
  COLUMNS: {
    STATUS: 0, // A
    NAME: 1, // B
    PROFILE_URL: 2, // C
    COMPANY: 3, // D
    ROLE: 4, // E
    COHORT: 5, // F
    WARMUP: 6, // G
    WARMUP_TS: 7, // H
    CONNECT: 8, // I
    CONNECT_TS: 9, // J
    CONNECTION_NOTE: 10, // K
    CHATTING: 11, // L
    CHATTING_TS: 12, // M
    CTA: 13, // N
    CTA_TS: 14, // O
    INTEREST: 15, // P
    INTEREST_TS: 16, // Q
    CONVERTED: 17, // R
    CONVERTED_TS: 18, // S
    DATE_ADDED: 19, // T
    NOTES: 20, // U
    TYPE: 21, // V
  },
}
