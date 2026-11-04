/**
 * Markbel Extension - In-Page Spotlight Command Palette (Alt+O)
 * Injected in an isolated Shadow DOM container to guarantee zero CSS style pollution.
 */

import { filterAndRankBookmarks, type SearchBookmarkItem } from '@/lib/searchCatalog';

export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class MarkbelSpotlight {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private overlay: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private chipsRow: HTMLElement | null = null;
  private resultsList: HTMLElement | null = null;
  private countBadge: HTMLElement | null = null;
  private clearButton: HTMLButtonElement | null = null;

  private isVisible: boolean = false;
  private catalog: SearchBookmarkItem[] | null = null;
  private filtered: SearchBookmarkItem[] = [];
  private selectedIndex: number = 0;
  private activeGroup: string = 'All';
  private previousActiveElement: HTMLElement | null = null;

  constructor() {
    // Spotlight initialized without registering external global listeners.
    // UI events are bound inside ensureMounted().
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
      .spotlight-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 14vh;
        box-sizing: border-box;
      }
      .spotlight-modal {
        width: 620px;
        max-width: 92vw;
        background: #0b0f17;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: 70vh;
        animation: markbel-fade-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
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
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        gap: 12px;
        background: #101724;
      }
      .spotlight-search-icon {
        width: 18px;
        height: 18px;
        color: #94a3b8;
        flex-shrink: 0;
      }
      .spotlight-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 15px;
        color: #f1f5f9;
        font-family: inherit;
        line-height: 1.4;
      }
      .spotlight-input::placeholder {
        color: #64748b;
      }
      .spotlight-clear {
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .spotlight-clear:hover {
        color: #f1f5f9;
        background: rgba(255, 255, 255, 0.06);
      }
      .spotlight-count {
        font-size: 11px;
        color: #64748b;
        background: rgba(255, 255, 255, 0.06);
        padding: 2px 7px;
        border-radius: 9999px;
      }
      .spotlight-chips-row {
        display: flex;
        gap: 6px;
        padding: 8px 18px;
        background: #0c121d;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .spotlight-chips-row::-webkit-scrollbar {
        display: none;
      }
      .spotlight-chip {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #94a3b8;
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.12s ease;
      }
      .spotlight-chip:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #f1f5f9;
      }
      .spotlight-chip.active {
        background: #005fb8;
        color: #ffffff;
        border-color: #005fb8;
        font-weight: 600;
      }
      .spotlight-results {
        overflow-y: auto;
        max-height: 380px;
        min-height: 80px;
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .spotlight-results::-webkit-scrollbar {
        width: 6px;
      }
      .spotlight-results::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
      }
      .spotlight-item {
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
      }
      .spotlight-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .spotlight-item.selected {
        background: rgba(0, 95, 184, 0.18);
        border-left: 3px solid #005fb8;
      }
      .spotlight-item-icon {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .spotlight-item-fallback-icon {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .spotlight-item-info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        gap: 3px;
      }
      .spotlight-item-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .spotlight-item-title {
        font-size: 13px;
        font-weight: 600;
        color: #f1f5f9;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .spotlight-item-group {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        flex-shrink: 0;
      }
      .spotlight-item-pin {
        font-size: 11px;
        color: #3b82f6;
        display: inline-flex;
        align-items: center;
      }
      .spotlight-item-url {
        font-size: 11px;
        color: #64748b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .spotlight-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 36px 16px;
        color: #64748b;
        font-size: 13px;
        text-align: center;
        gap: 6px;
      }
      .spotlight-empty strong {
        color: #94a3b8;
      }
      .spotlight-footer {
        padding: 10px 16px;
        background: #080c12;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 11px;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
      }
      .spotlight-hints {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      kbd {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 3px;
        padding: 1px 5px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        color: #cbd5e1;
      }
      .spotlight-brand {
        font-size: 11px;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.02em;
      }
      .hidden {
        display: none !important;
      }
    `;

    this.shadow.appendChild(style);

    // Structure
    this.overlay = document.createElement('div');
    this.overlay.className = 'spotlight-overlay';
    this.overlay.innerHTML = `
      <div class="spotlight-modal" role="dialog" aria-modal="true" aria-label="Markbel Spotlight">
        <div class="spotlight-search-bar">
          <svg class="spotlight-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="spotlight-input" placeholder="Search bookmarks (title, group, url)..." autocomplete="off" spellcheck="false" />
          <span class="spotlight-count hidden"></span>
          <button type="button" class="spotlight-clear hidden">&times;</button>
        </div>
        <div class="spotlight-chips-row"></div>
        <div class="spotlight-results" role="listbox"></div>
        <div class="spotlight-footer">
          <div class="spotlight-hints">
            <span><kbd>&uarr;&darr;</kbd> Navigate</span>
            <span><kbd>&crarr;</kbd> Open</span>
            <span><kbd>Ctrl+&crarr;</kbd> New Tab</span>
            <span><kbd>Shift+&crarr;</kbd> Background</span>
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

    // Attach overlay events
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
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

    this.resultsList?.addEventListener('click', (e) => {
      const itemEl = (e.target as HTMLElement).closest('.spotlight-item');
      if (!itemEl) return;
      const idx = Number(itemEl.getAttribute('data-index'));
      if (!isNaN(idx) && this.filtered[idx]) {
        this.executeItemAction(this.filtered[idx], e.ctrlKey || e.metaKey, !e.shiftKey);
      }
    });

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
          if (this.searchInput) {
            const original = this.searchInput.placeholder;
            this.searchInput.placeholder = 'URL copied to clipboard!';
            setTimeout(() => {
              if (this.searchInput) this.searchInput.placeholder = original;
            }, 1400);
          }
        }
      }
    });

    document.documentElement.appendChild(this.host);
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

    this.resultsList.innerHTML = this.filtered
      .map((item, idx) => {
        const isSelected = idx === this.selectedIndex;
        const initial = (item.title || item.url || '?').charAt(0).toUpperCase();
        const iconHtml = item.favicon
          ? `<img class="spotlight-item-icon" src="${escapeHtml(item.favicon)}" alt="" />
             <div class="spotlight-item-fallback-icon" style="display: none;">${escapeHtml(initial)}</div>`
          : `<div class="spotlight-item-fallback-icon">${escapeHtml(initial)}</div>`;

        let domain = '';
        try {
          domain = new URL(item.url).hostname.replace(/^www\./, '');
        } catch {
          domain = item.url;
        }

        return `
          <div class="spotlight-item ${isSelected ? 'selected' : ''}" data-index="${idx}" role="option" aria-selected="${isSelected}">
            ${iconHtml}
            <div class="spotlight-item-info">
              <div class="spotlight-item-header">
                <span class="spotlight-item-title">${escapeHtml(item.title || item.url)}</span>
                ${item.isPinned ? `<span class="spotlight-item-pin" title="Pinned">★</span>` : ''}
                <span class="spotlight-item-group">${escapeHtml(item.group || 'Unsorted')}</span>
              </div>
              <span class="spotlight-item-url">${escapeHtml(domain)}</span>
            </div>
          </div>
        `;
      })
      .join('');

    this.resultsList.querySelectorAll<HTMLImageElement>('img.spotlight-item-icon').forEach((img) => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        const fallback = img.nextElementSibling as HTMLElement | null;
        if (fallback) fallback.style.display = 'flex';
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
