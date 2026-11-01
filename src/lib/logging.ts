// Simple logging utility for the workspace
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? data : '')
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data ? data : '')
  },
  error: (message: string, data?: any) => {
    console.error(`[ERROR] ${message}`, data ? data : '')
  },
  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[DEBUG] ${message}`, data ? data : '')
    }
  }
}