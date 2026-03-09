/**
 * Device vibration (rumble/haptics) utility.
 * Silently no-ops on unsupported browsers.
 */
export function rumble(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently ignore errors (e.g. permissions denied)
    }
  }
}
