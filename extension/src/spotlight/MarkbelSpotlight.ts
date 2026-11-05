/**
 * Markbel Extension - In-Page Spotlight Command Palette (Alt+O)
 * Injected in an isolated Shadow DOM container to guarantee zero CSS style pollution.
 * Features dual-mode rendering (Visual Cards vs Compact List) and theme synchronization.
 */

import { filterAndRankBookmarks, type SearchBookmarkItem } from '@/lib/searchCatalog';
import { isLowQualityImage } from '@/lib/mediaHeuristics';
import { parseSeriesProgression, formatEpisodicBadge } from '@/lib/seriesProgression';

export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getGroupColorToken(groupName?: string): { color: string; bg: string; border: string } {
  const g = (groupName || '').toLowerCase().trim();
  if (g.includes('anime') || g.includes('cartoon') || g.includes('manga')) {
    return { color: '#818cf8', bg: 'rgba(99, 102, 241, 0.14)', border: 'rgba(99, 102, 241, 0.28)' };
  }
  if (g.includes('dev') || g.includes('code') || g.includes('tech') || g.includes('github')) {
    return { color: '#34d399', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.28)' };
  }
  if (g.includes('music') || g.includes('audio') || g.includes('podcast')) {
    return { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.28)' };
  }
  if (g.includes('insta') || g.includes('social') || g.includes('media') || g.includes('tiktok')) {
    return { color: '#f472b6', bg: 'rgba(236, 72, 153, 0.14)', border: 'rgba(236, 72, 153, 0.28)' };
  }
  if (g.includes('deen') || g.includes('islam') || g.includes('quran')) {
    return { color: '#2dd4bf', bg: 'rgba(20, 184, 166, 0.14)', border: 'rgba(20, 184, 166, 0.28)' };
  }
  if (g.includes('tool') || g.includes('util') || g.includes('app')) {
    return { color: '#38bdf8', bg: 'rgba(6, 182, 212, 0.14)', border: 'rgba(6, 182, 212, 0.28)' };
  }
  if (g.includes('design') || g.includes('art') || g.includes('photo')) {
    return { color: '#fb7185', bg: 'rgba(244, 63, 94, 0.14)', border: 'rgba(244, 63, 94, 0.28)' };
  }
  if (g.includes('read') || g.includes('book') || g.includes('article') || g.includes('news')) {
    return { color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.14)', border: 'rgba(139, 92, 246, 0.28)' };
  }
  return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.25)' };
}

export function inferContentType(item: SearchBookmarkItem): string {
  if (item.contentType) {
    const ct = item.contentType.toLowerCase();
    if (ct === 'video') return 'Video';
    if (ct === 'audio') return 'Audio';
    if (ct === 'article') return 'Article';
    if (ct === 'code') return 'Code';
    if (ct === 'playlist') return 'Playlist';
    if (ct === 'tweet') return 'Social';
  }
  const u = (item.url || '').toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com') || u.includes('anime3rb.com') || u.includes('egydead')) {
    return 'Video';
  }
  if (u.includes('github.com') || u.includes('gitlab.com') || u.includes('stackoverflow.com')) {
    return 'Code';
  }
  if (u.includes('twitter.com') || u.includes('x.com') || u.includes('instagram.com') || u.includes('tiktok.com') || u.includes('reddit.com')) {
    return 'Social';
  }
  if (u.includes('spotify.com') || u.includes('soundcloud.com') || u.includes('podcast')) {
    return 'Audio';
  }
  return 'Web';
}

export function detectSeriesBadge(item: SearchBookmarkItem): string | null {
  if (typeof item.seriesEpisode === 'number' && item.seriesEpisode > 0) {
    return formatEpisodicBadge({ episode: item.seriesEpisode, season: item.seriesSeason });
  }
  const progression = parseSeriesProgression(item.url, item.title);
  if (progression && progression.episode > 0) {
    return formatEpisodicBadge(progression);
  }
  return null;
}

const SUN_ICON = `<svg class="spotlight-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const MOON_ICON = `<svg class="spotlight-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
const GRID_ICON = `<svg class="spotlight-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`;
const LIST_ICON = `<svg class="spotlight-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`;
const COPY_ICON = `<svg class="spotlight-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const EXTERNAL_ICON = `<svg class="spotlight-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

export class MarkbelSpotlight {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private overlay: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private chipsRow: HTMLElement | null = null;
  private resultsList: HTMLElement | null = null;
  private countBadge: HTMLElement | null = null;
  private clearButton: HTMLButtonElement | null = null;
  private themeToggleButton: HTMLButtonElement | null = null;
  private viewToggleButton: HTMLButtonElement | null = null;

  private isVisible: boolean = false;
  private catalog: SearchBookmarkItem[] | null = null;
  private filtered: SearchBookmarkItem[] = [];
  private selectedIndex: number = 0;
  private activeGroup: string = 'All';
  private previousActiveElement: HTMLElement | null = null;

  private themeMode: 'light' | 'dark' = 'dark';
  private viewMode: 'visual' | 'compact' = 'visual';

  constructor() {
    this.initThemeAndViewMode();
  }

  private initThemeAndViewMode(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['markbel_theme_mode', 'markbel_spotlight_view_mode'], (res: { [key: string]: any }) => {
        if (res?.markbel_theme_mode === 'light' || res?.markbel_theme_mode === 'dark') {
          this.setTheme(res.markbel_theme_mode as 'light' | 'dark', false);
        }
        if (res?.markbel_spotlight_view_mode === 'compact' || res?.markbel_spotlight_view_mode === 'visual') {
          this.setViewMode(res.markbel_spotlight_view_mode as 'compact' | 'visual', false);
        }
      });

      chrome.storage.onChanged?.addListener((changes, area) => {
        if (area === 'local') {
          const newTheme = changes.markbel_theme_mode?.newValue;
          if (newTheme === 'light' || newTheme === 'dark') {
            this.setTheme(newTheme, false);
          }
          const newMode = changes.markbel_spotlight_view_mode?.newValue;
          if (newMode === 'compact' || newMode === 'visual') {
            this.setViewMode(newMode, false);
          }
        }
      });
    }
  }

  public setTheme(theme: 'light' | 'dark', persist: boolean = true): void {
    this.themeMode = theme;
    if (this.host) {
      this.host.setAttribute('data-theme', theme);
    }
    if (this.overlay) {
      this.overlay.classList.remove('theme-light', 'theme-dark');
      this.overlay.classList.add(`theme-${theme}`);
    }
    if (this.themeToggleButton) {
      this.themeToggleButton.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
      this.themeToggleButton.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
    if (persist && typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ markbel_theme_mode: theme });
    }
  }

  public setViewMode(mode: 'visual' | 'compact', persist: boolean = true): void {
    this.viewMode = mode;
    if (this.resultsList) {
      this.resultsList.classList.remove('view-visual', 'view-compact');
      this.resultsList.classList.add(`view-${mode}`);
    }
    if (this.viewToggleButton) {
      this.viewToggleButton.innerHTML = mode === 'visual' ? LIST_ICON : GRID_ICON;
      this.viewToggleButton.title = mode === 'visual' ? 'Switch to Compact List' : 'Switch to Visual Cards';
    }
    if (persist && typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ markbel_spotlight_view_mode: mode });
    }
    if (this.isVisible) {
      this.render();
    }
  }

  public refreshCatalog(): void {
    this.catalog = null;
    if (this.isVisible) {
      this.fetchCatalog();
    }
  }

  private ensureMounted(): void {
    if (this.host && this.shadow) return;

    this.host = document.createElement('markbel-spotlight-host');
    this.host.style.position = 'fixed';
    this.host.style.inset = '0';
    this.host.style.zIndex = '2147483647';
    this.host.style.display = 'none';
    this.host.setAttribute('data-theme', this.themeMode);

    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject isolated styles
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      /* Light Mode Design Tokens */
      :host([data-theme="light"]), .spotlight-overlay.theme-light {
        --sp-bg-canvas: rgba(251, 250, 248, 0.85);
        --sp-bg-surface: #ffffff;
        --sp-bg-muted: #f4f2ed;
        --sp-bg-hover: #eceae3;
        --sp-border: #e7e5de;
        --sp-border-strong: #d5d1c6;
        --sp-text-primary: #18181b;
        --sp-text-secondary: #52525b;
        --sp-text-muted: #71717a;
        --sp-accent: #4f46e5;
        --sp-accent-soft: rgba(79, 70, 229, 0.08);
        --sp-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
        --sp-item-selected: rgba(79, 70, 229, 0.1);
        --sp-kbd-bg: rgba(0, 0, 0, 0.06);
        --sp-kbd-border: rgba(0, 0, 0, 0.12);
        --sp-kbd-text: #52525b;
      }

      /* Dark Mode Design Tokens */
      :host([data-theme="dark"]), .spotlight-overlay.theme-dark {
        --sp-bg-canvas: rgba(9, 13, 22, 0.85);
        --sp-bg-surface: #111726;
        --sp-bg-muted: #182032;
        --sp-bg-hover: #1e283d;
        --sp-border: rgba(255, 255, 255, 0.08);
        --sp-border-strong: rgba(255, 255, 255, 0.16);
        --sp-text-primary: #f8fafc;
        --sp-text-secondary: #94a3b8;
        --sp-text-muted: #64748b;
        --sp-accent: #6366f1;
        --sp-accent-soft: rgba(99, 102, 241, 0.15);
        --sp-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
        --sp-item-selected: rgba(99, 102, 241, 0.18);
        --sp-kbd-bg: rgba(255, 255, 255, 0.08);
        --sp-kbd-border: rgba(255, 255, 255, 0.12);
        --sp-kbd-text: #cbd5e1;
      }

      .spotlight-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 11vh;
        box-sizing: border-box;
      }
      .spotlight-modal {
        width: 660px;
        max-width: 94vw;
        background: var(--sp-bg-surface);
        border: 1px solid var(--sp-border-strong);
        border-radius: 14px;
        box-shadow: var(--sp-shadow);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: 74vh;
        animation: markbel-fade-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        color: var(--sp-text-primary);
      }
      @keyframes markbel-fade-in {
        from {
          opacity: 0;
          transform: scale(0.98) translateY(-6px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      .spotlight-search-bar {
        padding: 12px 16px;
        border-bottom: 1px solid var(--sp-border);
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--sp-bg-surface);
      }
      .spotlight-search-icon {
        width: 18px;
        height: 18px;
        color: var(--sp-text-muted);
        flex-shrink: 0;
      }
      .spotlight-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 15px;
        color: var(--sp-text-primary);
        font-family: inherit;
        line-height: 1.4;
      }
      .spotlight-input::placeholder {
        color: var(--sp-text-muted);
      }
      .spotlight-count {
        font-size: 11px;
        color: var(--sp-text-muted);
        background: var(--sp-bg-muted);
        border: 1px solid var(--sp-border);
        padding: 2px 7px;
        border-radius: 9999px;
      }
      .spotlight-icon-btn {
        background: transparent;
        border: 1px solid transparent;
        color: var(--sp-text-muted);
        width: 28px;
        height: 28px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.12s ease;
      }
      .spotlight-icon-btn:hover {
        background: var(--sp-bg-hover);
        color: var(--sp-text-primary);
        border-color: var(--sp-border);
      }
      .spotlight-btn-icon {
        width: 16px;
        height: 16px;
      }
      .spotlight-clear {
        background: transparent;
        border: none;
        color: var(--sp-text-muted);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .spotlight-clear:hover {
        color: var(--sp-text-primary);
        background: var(--sp-bg-hover);
      }
      .spotlight-chips-row {
        display: flex;
        gap: 6px;
        padding: 8px 16px;
        background: var(--sp-bg-muted);
        border-bottom: 1px solid var(--sp-border);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .spotlight-chips-row::-webkit-scrollbar {
        display: none;
      }
      .spotlight-chip {
        background: var(--sp-bg-surface);
        border: 1px solid var(--sp-border);
        color: var(--sp-text-secondary);
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.12s ease;
      }
      .spotlight-chip:hover {
        background: var(--sp-bg-hover);
        color: var(--sp-text-primary);
      }
      .spotlight-chip.active {
        background: var(--sp-accent);
        color: #ffffff;
        border-color: var(--sp-accent);
        font-weight: 600;
      }
      .spotlight-results {
        overflow-y: auto;
        max-height: 400px;
        min-height: 90px;
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .spotlight-results::-webkit-scrollbar {
        width: 6px;
      }
      .spotlight-results::-webkit-scrollbar-thumb {
        background: var(--sp-border-strong);
        border-radius: 4px;
      }

      /* View Mode: Visual Cards */
      .spotlight-results.view-visual .spotlight-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.1s ease;
        border-left: 3px solid transparent;
        text-decoration: none;
        user-select: none;
        position: relative;
      }
      .spotlight-results.view-visual .spotlight-item:hover {
        background: var(--sp-bg-hover);
      }
      .spotlight-results.view-visual .spotlight-item.selected {
        background: var(--sp-item-selected);
        border-left: 3px solid var(--sp-accent);
      }
      .spotlight-item-thumb-box {
        width: 56px;
        height: 38px;
        border-radius: 6px;
        background: var(--sp-bg-muted);
        border: 1px solid var(--sp-border);
        overflow: hidden;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .spotlight-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .spotlight-item-thumb-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
      }
      .spotlight-thumb-favicon {
        width: 20px;
        height: 20px;
        object-fit: contain;
      }
      .spotlight-item-info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        gap: 4px;
      }
      .spotlight-item-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }
      .spotlight-item-title {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--sp-text-primary);
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        word-break: break-word;
      }
      .spotlight-item-pin {
        font-size: 12px;
        color: #f59e0b;
        flex-shrink: 0;
      }
      .spotlight-item-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 11px;
        color: var(--sp-text-secondary);
      }
      .spotlight-tag-pill {
        font-size: 10px;
        font-weight: 600;
        padding: 1.5px 6px;
        border-radius: 4px;
        letter-spacing: 0.02em;
        display: inline-flex;
        align-items: center;
        line-height: 1.2;
      }
      .spotlight-tag-pill.tag-series {
        background: rgba(99, 102, 241, 0.12);
        color: var(--sp-accent);
        border: 1px solid rgba(99, 102, 241, 0.25);
      }
      .spotlight-tag-pill.tag-type {
        background: var(--sp-bg-muted);
        color: var(--sp-text-muted);
        border: 1px solid var(--sp-border);
      }
      .spotlight-domain-row {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--sp-text-muted);
      }
      .spotlight-domain-favicon {
        width: 12px;
        height: 12px;
        object-fit: contain;
        border-radius: 2px;
      }
      .spotlight-actions {
        display: none;
        align-items: center;
        gap: 4px;
        margin-left: 6px;
        flex-shrink: 0;
      }
      .spotlight-item:hover .spotlight-actions,
      .spotlight-item.selected .spotlight-actions {
        display: flex;
      }
      .spotlight-action-btn {
        background: var(--sp-bg-surface);
        border: 1px solid var(--sp-border);
        color: var(--sp-text-secondary);
        border-radius: 4px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.12s ease;
      }
      .spotlight-action-btn:hover {
        background: var(--sp-bg-hover);
        color: var(--sp-text-primary);
        border-color: var(--sp-border-strong);
      }
      .spotlight-action-icon {
        width: 13px;
        height: 13px;
      }

      /* View Mode: Compact List */
      .spotlight-results.view-compact .spotlight-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.1s ease;
        border-left: 3px solid transparent;
        user-select: none;
      }
      .spotlight-results.view-compact .spotlight-item:hover {
        background: var(--sp-bg-hover);
      }
      .spotlight-results.view-compact .spotlight-item.selected {
        background: var(--sp-item-selected);
        border-left: 3px solid var(--sp-accent);
      }
      .spotlight-results.view-compact .spotlight-item-thumb-box {
        display: none;
      }
      .spotlight-results.view-compact .spotlight-compact-favicon {
        width: 18px;
        height: 18px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .spotlight-results.view-compact .spotlight-item-title {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 13px;
      }
      .spotlight-results.view-compact .spotlight-item-header {
        align-items: center;
      }

      .spotlight-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 36px 16px;
        color: var(--sp-text-muted);
        font-size: 13px;
        text-align: center;
        gap: 6px;
      }
      .spotlight-empty strong {
        color: var(--sp-text-primary);
      }
      .spotlight-footer {
        padding: 10px 16px;
        background: var(--sp-bg-muted);
        border-top: 1px solid var(--sp-border);
        font-size: 11px;
        color: var(--sp-text-muted);
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
      }
      .spotlight-hints {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      kbd {
        background: var(--sp-kbd-bg);
        border: 1px solid var(--sp-kbd-border);
        border-radius: 3px;
        padding: 1px 5px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        color: var(--sp-kbd-text);
      }
      .spotlight-brand {
        font-size: 11px;
        font-weight: 700;
        color: var(--sp-text-secondary);
        letter-spacing: 0.02em;
      }
      .hidden {
        display: none !important;
      }
    `;

    this.shadow.appendChild(style);

    // Structure
    this.overlay = document.createElement('div');
    this.overlay.className = `spotlight-overlay theme-${this.themeMode}`;
    this.overlay.innerHTML = `
      <div class="spotlight-modal" role="dialog" aria-modal="true" aria-label="Markbel Spotlight">
        <div class="spotlight-search-bar">
          <svg class="spotlight-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="spotlight-input" placeholder="Search bookmarks (title, group, url)..." autocomplete="off" spellcheck="false" />
          <span class="spotlight-count hidden"></span>
          <button type="button" class="spotlight-clear hidden" title="Clear search">&times;</button>
          <button type="button" class="spotlight-icon-btn spotlight-view-toggle" title="${
            this.viewMode === 'visual' ? 'Switch to Compact List' : 'Switch to Visual Cards'
          }">${this.viewMode === 'visual' ? LIST_ICON : GRID_ICON}</button>
          <button type="button" class="spotlight-icon-btn spotlight-theme-toggle" title="${
            this.themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
          }">${this.themeMode === 'dark' ? SUN_ICON : MOON_ICON}</button>
        </div>
        <div class="spotlight-chips-row"></div>
        <div class="spotlight-results view-${this.viewMode}" role="listbox"></div>
        <div class="spotlight-footer">
          <div class="spotlight-hints">
            <span><kbd>&uarr;&darr;</kbd> Navigate</span>
            <span><kbd>&crarr;</kbd> Open</span>
            <span><kbd>Ctrl+&crarr;</kbd> New Tab</span>
            <span><kbd>Ctrl+C</kbd> Copy URL</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
          <div class="spotlight-brand">
            <span>Markbel</span>
          </div>
        </div>
      </div>
    `;

    this.shadow.appendChild(this.overlay);

    this.searchInput = this.shadow.querySelector('.spotlight-input');
    this.chipsRow = this.shadow.querySelector('.spotlight-chips-row');
    this.resultsList = this.shadow.querySelector('.spotlight-results');
    this.countBadge = this.shadow.querySelector('.spotlight-count');
    this.clearButton = this.shadow.querySelector('.spotlight-clear');
    this.themeToggleButton = this.shadow.querySelector('.spotlight-theme-toggle');
    this.viewToggleButton = this.shadow.querySelector('.spotlight-view-toggle');

    // Attach overlay events
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Theme toggle click
    this.themeToggleButton?.addEventListener('click', () => {
      const nextTheme = this.themeMode === 'dark' ? 'light' : 'dark';
      this.setTheme(nextTheme, true);
    });

    // View toggle click
    this.viewToggleButton?.addEventListener('click', () => {
      const nextMode = this.viewMode === 'visual' ? 'compact' : 'visual';
      this.setViewMode(nextMode, true);
    });

    this.searchInput?.addEventListener('input', () => {
      const val = this.searchInput?.value || '';
      if (this.clearButton) {
        this.clearButton.classList.toggle('hidden', !val);
      }
      this.selectedIndex = 0;
      this.render();
    });

    this.clearButton?.addEventListener('click', () => {
      if (this.searchInput) {
        this.searchInput.value = '';
        this.searchInput.focus();
      }
      this.clearButton?.classList.add('hidden');
      this.selectedIndex = 0;
      this.render();
    });

    this.chipsRow?.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest('.spotlight-chip');
      if (!chip) return;
      const group = chip.getAttribute('data-group');
      if (group) {
        this.activeGroup = group;
        this.chipsRow?.querySelectorAll('.spotlight-chip').forEach((c) => {
          c.classList.toggle('active', c.getAttribute('data-group') === group);
        });
        this.selectedIndex = 0;
        this.render();
        this.searchInput?.focus();
      }
    });

    // Results click & Action buttons click
    this.resultsList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Copy Action Button
      const copyBtn = target.closest('.spotlight-action-copy');
      if (copyBtn) {
        e.stopPropagation();
        const url = copyBtn.getAttribute('data-url');
        if (url) {
          navigator.clipboard.writeText(url);
          this.showActionFeedback('URL copied to clipboard!');
        }
        return;
      }

      // Open in New Tab Action Button
      const newTabBtn = target.closest('.spotlight-action-newtab');
      if (newTabBtn) {
        e.stopPropagation();
        const url = newTabBtn.getAttribute('data-url');
        if (url) {
          this.executeItemAction({ url } as SearchBookmarkItem, true, true);
        }
        return;
      }

      // Row item click
      const itemEl = target.closest('.spotlight-item');
      if (!itemEl) return;
      const idx = Number(itemEl.getAttribute('data-index'));
      if (!isNaN(idx) && this.filtered[idx]) {
        this.executeItemAction(this.filtered[idx], e.ctrlKey || e.metaKey, !e.shiftKey);
      }
    });

    // Global Keydown Inside Shadow DOM
    this.shadow.addEventListener('keydown', (event: Event) => {
      const e = event as KeyboardEvent;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (this.filtered.length > 0) {
          this.selectedIndex = Math.min(this.selectedIndex + 1, this.filtered.length - 1);
          this.renderSelection();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (this.filtered.length > 0) {
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.renderSelection();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (this.filtered.length > 0 && this.filtered[this.selectedIndex]) {
          const selected = this.filtered[this.selectedIndex];
          const newTab = e.ctrlKey || e.metaKey || e.shiftKey;
          const active = !e.shiftKey;
          this.executeItemAction(selected, newTab, active);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const shadowWithSel = this.shadow as unknown as { getSelection?: () => Selection | null };
        const selText = shadowWithSel?.getSelection ? shadowWithSel.getSelection()?.toString() : '';
        if (selText && selText.trim()) return;

        if (this.filtered[this.selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(this.filtered[this.selectedIndex].url);
          this.showActionFeedback('URL copied to clipboard!');
        }
      }
    });

    document.documentElement.appendChild(this.host);
  }

  private showActionFeedback(text: string): void {
    if (this.searchInput) {
      const original = this.searchInput.placeholder;
      this.searchInput.placeholder = text;
      setTimeout(() => {
        if (this.searchInput) this.searchInput.placeholder = original;
      }, 1400);
    }
  }

  private executeItemAction(item: SearchBookmarkItem, newTab: boolean, active: boolean): void {
    if (newTab) {
      chrome.runtime.sendMessage({
        type: 'MARKBEL_OPEN_TAB',
        url: item.url,
        active,
      });
      this.hide();
    } else {
      this.hide();
      window.location.href = item.url;
    }
  }

  private fetchCatalog(): void {
    chrome.runtime.sendMessage({ type: 'MARKBEL_GET_SEARCH_CATALOG' }, (res) => {
      if (res && res.success && Array.isArray(res.catalog)) {
        this.catalog = res.catalog;
        this.renderChips();
        this.render();
      }
    });
  }

  private renderChips(): void {
    if (!this.chipsRow || !this.catalog) return;

    const groups = new Set<string>();
    for (const b of this.catalog) {
      if (b.group && b.group.trim()) {
        groups.add(b.group.trim());
      }
    }

    const groupList = ['All', ...Array.from(groups).sort()];
    this.chipsRow.innerHTML = groupList
      .map(
        (g) =>
          `<button type="button" class="spotlight-chip ${
            g.toLowerCase() === this.activeGroup.toLowerCase() ? 'active' : ''
          }" data-group="${escapeHtml(g)}">${escapeHtml(g)}</button>`
      )
      .join('');
  }

  private render(): void {
    if (!this.resultsList) return;

    const query = this.searchInput?.value || '';
    this.filtered = filterAndRankBookmarks(this.catalog || [], query, this.activeGroup);

    if (this.countBadge) {
      if (query.trim()) {
        this.countBadge.textContent = `${this.filtered.length} found`;
        this.countBadge.classList.remove('hidden');
      } else {
        this.countBadge.classList.add('hidden');
      }
    }

    if (this.filtered.length === 0) {
      this.resultsList.innerHTML = `
        <div class="spotlight-empty">
          <p>No bookmarks found for "<strong>${escapeHtml(query)}</strong>"</p>
          <span style="font-size: 11px; opacity: 0.7;">Try searching by title, group, or domain</span>
        </div>
      `;
      return;
    }

    if (this.selectedIndex >= this.filtered.length) {
      this.selectedIndex = 0;
    }

    const isVisual = this.viewMode === 'visual';

    this.resultsList.innerHTML = this.filtered
      .map((item, idx) => {
        const isSelected = idx === this.selectedIndex;
        const groupColor = getGroupColorToken(item.group);
        const seriesBadge = detectSeriesBadge(item);
        const contentType = inferContentType(item);

        let domain = '';
        try {
          domain = new URL(item.url).hostname.replace(/^www\./, '');
        } catch {
          domain = item.url;
        }

        const initial = (item.title || item.url || '?').charAt(0).toUpperCase();

        if (isVisual) {
          const hasCover = item.image && !isLowQualityImage(item.image);
          const thumbBoxHtml = hasCover
            ? `<div class="spotlight-item-thumb-box">
                 <img class="spotlight-thumb" src="${escapeHtml(item.image!)}" alt="" loading="lazy" />
                 <div class="spotlight-item-thumb-fallback" style="display: none; background: ${groupColor.bg}; color: ${groupColor.color};">
                   ${item.favicon ? `<img class="spotlight-thumb-favicon" src="${escapeHtml(item.favicon)}" alt="" />` : escapeHtml(initial)}
                 </div>
               </div>`
            : `<div class="spotlight-item-thumb-box">
                 <div class="spotlight-item-thumb-fallback" style="background: ${groupColor.bg}; color: ${groupColor.color};">
                   ${item.favicon ? `<img class="spotlight-thumb-favicon" src="${escapeHtml(item.favicon)}" alt="" />` : escapeHtml(initial)}
                 </div>
               </div>`;

          return `
            <div class="spotlight-item ${isSelected ? 'selected' : ''}" data-index="${idx}" role="option" aria-selected="${isSelected}">
              ${thumbBoxHtml}
              <div class="spotlight-item-info">
                <div class="spotlight-item-header">
                  <span class="spotlight-item-title">${escapeHtml(item.title || item.url)}</span>
                  ${item.isPinned ? `<span class="spotlight-item-pin" title="Pinned">★</span>` : ''}
                </div>
                <div class="spotlight-item-meta">
                  <span class="spotlight-tag-pill" style="color: ${groupColor.color}; background: ${groupColor.bg}; border: 1px solid ${groupColor.border};">${escapeHtml(item.group || 'Unsorted')}</span>
                  ${seriesBadge ? `<span class="spotlight-tag-pill tag-series">${escapeHtml(seriesBadge)}</span>` : ''}
                  <span class="spotlight-domain-row">
                    ${item.favicon ? `<img class="spotlight-domain-favicon" src="${escapeHtml(item.favicon)}" alt="" />` : ''}
                    <span>${escapeHtml(domain)}</span>
                  </span>
                  <span class="spotlight-tag-pill tag-type">${escapeHtml(contentType)}</span>
                </div>
              </div>
              <div class="spotlight-actions">
                <button type="button" class="spotlight-action-btn spotlight-action-copy" data-url="${escapeHtml(item.url)}" title="Copy URL (Ctrl+C)">
                  ${COPY_ICON}
                </button>
                <button type="button" class="spotlight-action-btn spotlight-action-newtab" data-url="${escapeHtml(item.url)}" title="Open in New Tab (Ctrl+Enter)">
                  ${EXTERNAL_ICON}
                </button>
              </div>
            </div>
          `;
        } else {
          // Compact Mode: 1-line dense view
          const iconHtml = item.favicon
            ? `<img class="spotlight-compact-favicon" src="${escapeHtml(item.favicon)}" alt="" />`
            : `<div class="spotlight-compact-favicon" style="display:flex;align-items:center;justify-content:center;border-radius:3px;background:${groupColor.bg};color:${groupColor.color};font-size:10px;font-weight:700;">${escapeHtml(initial)}</div>`;

          return `
            <div class="spotlight-item ${isSelected ? 'selected' : ''}" data-index="${idx}" role="option" aria-selected="${isSelected}">
              ${iconHtml}
              <div class="spotlight-item-info">
                <div class="spotlight-item-header">
                  <span class="spotlight-item-title">${escapeHtml(item.title || item.url)}</span>
                  ${item.isPinned ? `<span class="spotlight-item-pin" title="Pinned">★</span>` : ''}
                </div>
              </div>
              <div class="spotlight-item-meta">
                <span class="spotlight-tag-pill" style="color: ${groupColor.color}; background: ${groupColor.bg}; border: 1px solid ${groupColor.border};">${escapeHtml(item.group || 'Unsorted')}</span>
                ${seriesBadge ? `<span class="spotlight-tag-pill tag-series">${escapeHtml(seriesBadge)}</span>` : ''}
                <span class="spotlight-domain-row">
                  <span>${escapeHtml(domain)}</span>
                </span>
              </div>
              <div class="spotlight-actions">
                <button type="button" class="spotlight-action-btn spotlight-action-copy" data-url="${escapeHtml(item.url)}" title="Copy URL">
                  ${COPY_ICON}
                </button>
              </div>
            </div>
          `;
        }
      })
      .join('');

    // Handle thumbnail & favicon errors
    this.resultsList.querySelectorAll<HTMLImageElement>('img.spotlight-thumb').forEach((img) => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        const fallback = img.nextElementSibling as HTMLElement | null;
        if (fallback) fallback.style.display = 'flex';
      }, { once: true });
    });

    this.resultsList.querySelectorAll<HTMLImageElement>('img.spotlight-thumb-favicon, img.spotlight-domain-favicon, img.spotlight-compact-favicon').forEach((img) => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
      }, { once: true });
    });

    this.renderSelection();
  }

  private renderSelection(): void {
    if (!this.resultsList) return;
    const items = this.resultsList.querySelectorAll<HTMLElement>('.spotlight-item');
    items.forEach((el, idx) => {
      if (idx === this.selectedIndex) {
        el.classList.add('selected');
        el.setAttribute('aria-selected', 'true');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('selected');
        el.setAttribute('aria-selected', 'false');
      }
    });
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public show(): void {
    this.ensureMounted();
    if (!this.host) return;

    this.previousActiveElement = document.activeElement as HTMLElement | null;
    this.host.style.display = 'block';
    this.isVisible = true;

    if (!this.catalog) {
      this.fetchCatalog();
    } else {
      this.render();
    }

    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.focus();
        this.searchInput.select();
      }
    }, 20);
  }

  public hide(): void {
    if (!this.host || !this.isVisible) return;

    this.host.style.display = 'none';
    this.isVisible = false;

    if (this.searchInput) {
      this.searchInput.value = '';
    }
    this.clearButton?.classList.add('hidden');
    this.selectedIndex = 0;

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      try {
        this.previousActiveElement.focus();
      } catch {}
    }
  }
}
