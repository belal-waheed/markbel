import { useEffect, useRef } from 'react'

export interface SwipeGestureOptions {
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  minDistance?: number
  maxVerticalRatio?: number
  edgeOnly?: boolean
  maxEdgeStartX?: number
  enabled?: boolean
}

export interface SwipeEvaluationParams {
  startX: number
  startY: number
  endX: number
  endY: number
  minDistance?: number
  maxVerticalRatio?: number
  edgeOnly?: boolean
  maxEdgeStartX?: number
}

export interface SwipeEvaluationResult {
  isSwipe: boolean
  direction: 'left' | 'right' | null
}

/**
 * Pure swipe evaluation algorithm enforcing edge-swipe constraints and horizontal dominance.
 */
export function evaluateSwipeGesture({
  startX,
  startY,
  endX,
  endY,
  minDistance = 50,
  maxVerticalRatio = 0.8,
  edgeOnly = false,
  maxEdgeStartX = 36,
}: SwipeEvaluationParams): SwipeEvaluationResult {
  const deltaX = endX - startX
  const deltaY = endY - startY
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  // Ensure horizontal swipe is dominant and passes threshold
  if (absX >= minDistance && absY <= absX * maxVerticalRatio) {
    if (deltaX > 0) {
      if (!edgeOnly || startX <= maxEdgeStartX) {
        return { isSwipe: true, direction: 'right' }
      }
    } else if (deltaX < 0) {
      return { isSwipe: true, direction: 'left' }
    }
  }

  return { isSwipe: false, direction: null }
}

export function useSwipeGesture({
  onSwipeRight,
  onSwipeLeft,
  minDistance = 50,
  maxVerticalRatio = 0.8,
  edgeOnly = false,
  maxEdgeStartX = 36,
  enabled = true,
}: SwipeGestureOptions) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length !== 1) return

      const touch = e.changedTouches[0]
      const res = evaluateSwipeGesture({
        startX: touchStartRef.current.x,
        startY: touchStartRef.current.y,
        endX: touch.clientX,
        endY: touch.clientY,
        minDistance,
        maxVerticalRatio,
        edgeOnly,
        maxEdgeStartX,
      })
      touchStartRef.current = null

      if (res.isSwipe) {
        if (res.direction === 'right' && onSwipeRight) {
          onSwipeRight()
        } else if (res.direction === 'left' && onSwipeLeft) {
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
  }, [onSwipeRight, onSwipeLeft, minDistance, maxVerticalRatio, edgeOnly, maxEdgeStartX, enabled])
}
