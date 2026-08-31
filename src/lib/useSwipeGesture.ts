import { useEffect, useRef } from 'react'

interface SwipeGestureOptions {
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  minDistance?: number
  maxVerticalRatio?: number
  enabled?: boolean
}

export function useSwipeGesture({
  onSwipeRight,
  onSwipeLeft,
  minDistance = 50,
  maxVerticalRatio = 0.8,
  enabled = true,
}: SwipeGestureOptions) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length !== 1) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y
      touchStartRef.current = null

      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      // Ensure horizontal swipe is dominant and passes threshold
      if (absX >= minDistance && absY <= absX * maxVerticalRatio) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight()
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft()
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onSwipeRight, onSwipeLeft, minDistance, maxVerticalRatio, enabled])
}
