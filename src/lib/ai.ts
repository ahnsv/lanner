export enum AIModelAvailability {
  AVAILABLE = "available",
  DOWNLOAD_NEEDED = "download-needed",
  NOT_SUPPORTED = "not-supported",
  UNKNOWN = "unknown"
}

export function normalizeAvailability(rawAvailability: string | undefined): AIModelAvailability {
  if (typeof LanguageModel === "undefined") {
    return AIModelAvailability.NOT_SUPPORTED
  }

  // Handle various "ready" states
  if (rawAvailability === "readily" || rawAvailability === "available") {
    return AIModelAvailability.AVAILABLE
  }

  if (rawAvailability === "after-download") {
    return AIModelAvailability.DOWNLOAD_NEEDED
  }

  if (rawAvailability === "no") {
    return AIModelAvailability.NOT_SUPPORTED
  }

  return AIModelAvailability.UNKNOWN
}
