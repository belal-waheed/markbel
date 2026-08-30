export const vibrate = (pattern: number | number[]) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch (e) {
      // Ignore vibration errors
    }
  }
}

export const haptics = {
  // Light tap for minor interactions
  light: () => vibrate(10),
  
  // Medium tap for important actions (check off task)
  medium: () => vibrate(20),
  
  // Heavy tap for destructive actions or warnings
  heavy: () => vibrate(40),
  
  // Success pattern (e.g. completing a habit)
  success: () => vibrate([15, 100, 20]),
  
  // Warning/Error pattern
  error: () => vibrate([50, 100, 50, 100, 50]),
  
  // Timer completion
  timerEnd: () => vibrate([300, 200, 300, 200, 300]),
}
