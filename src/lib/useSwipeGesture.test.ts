import { describe, it, expect } from 'vitest';
import { evaluateSwipeGesture } from './useSwipeGesture';

describe('useSwipeGesture Edge-Swipe Algorithm Suite', () => {
  it('detects swipe-right from anywhere when edgeOnly is false', () => {
    const res = evaluateSwipeGesture({
      startX: 200,
      startY: 100,
      endX: 300,
      endY: 110,
      minDistance: 40,
      edgeOnly: false,
    });

    expect(res).toEqual({ isSwipe: true, direction: 'right' });
  });

  it('suppresses swipe-right when edgeOnly is true and startX > maxEdgeStartX', () => {
    // User swiping horizontally across tabs in center of screen
    const res = evaluateSwipeGesture({
      startX: 80,
      startY: 100,
      endX: 180,
      endY: 105,
      minDistance: 40,
      edgeOnly: true,
      maxEdgeStartX: 36,
    });

    expect(res).toEqual({ isSwipe: false, direction: null });
  });

  it('triggers swipe-right when edgeOnly is true and startX <= maxEdgeStartX', () => {
    // User initiating swipe from left bezel (startX = 20 <= 36)
    const res = evaluateSwipeGesture({
      startX: 20,
      startY: 100,
      endX: 120,
      endY: 105,
      minDistance: 40,
      edgeOnly: true,
      maxEdgeStartX: 36,
    });

    expect(res).toEqual({ isSwipe: true, direction: 'right' });
  });

  it('detects swipe-left regardless of start position to allow closing drawer', () => {
    // User swiping left to close open sidebar
    const res = evaluateSwipeGesture({
      startX: 250,
      startY: 100,
      endX: 150,
      endY: 105,
      minDistance: 40,
      edgeOnly: true,
      maxEdgeStartX: 36,
    });

    expect(res).toEqual({ isSwipe: true, direction: 'left' });
  });

  it('rejects gestures where vertical motion dominates horizontal motion', () => {
    // User scrolling down vertically (deltaY = 150, deltaX = 45)
    const res = evaluateSwipeGesture({
      startX: 20,
      startY: 100,
      endX: 65,
      endY: 250,
      minDistance: 40,
      edgeOnly: true,
      maxEdgeStartX: 36,
    });

    expect(res).toEqual({ isSwipe: false, direction: null });
  });

  it('rejects micro-gestures below minDistance', () => {
    // Small tap jitter (deltaX = 20 < 40)
    const res = evaluateSwipeGesture({
      startX: 10,
      startY: 100,
      endX: 30,
      endY: 100,
      minDistance: 40,
      edgeOnly: true,
      maxEdgeStartX: 36,
    });

    expect(res).toEqual({ isSwipe: false, direction: null });
  });
});
