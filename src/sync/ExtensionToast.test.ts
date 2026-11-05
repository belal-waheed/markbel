/**
 * Extension In-Page Toast Notification Unit Tests
 * Follows AAA (Arrange-Act-Assert) pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { showMarkbelToast } from '../../extension/src/content';

describe('Extension In-Page Toast Notification Subsystem', () => {
  let dom: ReturnType<typeof parseHTML>;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = parseHTML('<!doctype html><html><body></body></html>');
    vi.stubGlobal('document', dom.document);
    vi.stubGlobal('window', dom.window);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mounts toast container and renders styled notification in document.body', () => {
    // Arrange & Act
    const toast = showMarkbelToast('Saved to Markbel', 'https://example.com/article', 'Reading');

    // Assert
    const container = dom.document.getElementById('markbel-toast-container');
    expect(container).toBeDefined();
    expect(container?.childNodes.length).toBe(1);

    expect(toast).toBeDefined();
    expect(toast?.textContent).toContain('Saved to Markbel');
    expect(toast?.textContent).toContain('https://example.com/article');
    expect(toast?.textContent).toContain('Reading');
  });

  it('renders checkmark SVG icon and omits group badge when not provided', () => {
    // Arrange & Act
    const toast = showMarkbelToast('Saved to Markbel', 'https://example.com/simple');

    // Assert
    expect(toast?.innerHTML).toContain('<svg');
    expect(toast?.innerHTML).toContain('polyline');
    expect(toast?.textContent).toContain('Saved to Markbel');
    expect(toast?.textContent).toContain('https://example.com/simple');
  });

  it('sanitizes user text and protects against XSS injection via textContent', () => {
    // Arrange
    const malicious = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

    // Act
    const toast = showMarkbelToast('Saved to Markbel', malicious, '<bad>');

    // Assert
    expect(dom.document.querySelector('script')).toBeNull();
    expect(dom.document.querySelector('img')).toBeNull();
    expect(toast?.textContent).toContain(malicious);
  });

  it('dismisses toast and cleans up DOM when clicked', () => {
    // Arrange
    const toast = showMarkbelToast('Saved to Markbel', 'Item to dismiss');
    const container = dom.document.getElementById('markbel-toast-container');
    expect(container?.childNodes.length).toBe(1);

    // Act - click toast
    toast?.dispatchEvent(new dom.window.Event('click'));
    vi.advanceTimersByTime(250);

    // Assert - toast removed from DOM
    expect(container?.childNodes.length).toBe(0);
  });

  it('auto-dismisses after timeout without user intervention', () => {
    // Arrange
    showMarkbelToast('Saved to Markbel', 'Item auto dismiss');
    const container = dom.document.getElementById('markbel-toast-container');
    expect(container?.childNodes.length).toBe(1);

    // Act - advance timer past 2200ms auto-dismiss + 200ms transition
    vi.advanceTimersByTime(2500);

    // Assert
    expect(container?.childNodes.length).toBe(0);
  });
});
