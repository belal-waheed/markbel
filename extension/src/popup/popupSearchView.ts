/**
 * Markbel Extension - Popup HUD Search View Controller
 * 0ms local Dexie search, dynamic group filter chips, results list, and keyboard navigation.
 */

import { db } from '@/db/db';
import { filterAndRankBookmarks, SearchBookmarkItem } from '@/lib/searchCatalog';
import { escapeHtml } from './popupUtils';

/**
 * Format domain from URL for secondary display in search list
 */
export function formatDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Calculate next selected index in search list with optional wrapping
 */
export function getNextSearchIndex(currentIndex: number, total: number, wrap = false): number {
  if (total <= 0) return 0;
  if (wrap) {
    return (currentIndex + 1) % total;
  }
  return Math.min(currentIndex + 1, total - 1);
}

/**
 * Calculate previous selected index in search list with optional wrapping
 */
export function getPrevSearchIndex(currentIndex: number, total: number, wrap = false): number {
  if (total <= 0) return 0;
  if (wrap) {
    return (currentIndex - 1 + total) % total;
  }
  return Math.max(currentIndex - 1, 0);
}

// Controller State
let searchCatalog: SearchBookmarkItem[] = [];
let activeSearchGroup = 'All';
let selectedResultIndex = 0;
let filteredResults: SearchBookmarkItem[] = [];

export function getSearchCatalog(): SearchBookmarkItem[] {
  return searchCatalog;
}

export function getFilteredResults(): SearchBookmarkItem[] {
  return filteredResults;
}

export function getActiveSearchGroup(): string {
  return activeSearchGroup;
}

export function getSelectedResultIndex(): number {
  return selectedResultIndex;
}

/**
 * Load Search Catalog from IndexedDB
 */
export async function loadSearchCatalog(): Promise<SearchBookmarkItem[]> {
  try {
    const bookmarks = await db.bookmarks.filter((b) => !b.deletedAt).toArray();
    searchCatalog = bookmarks.map((b) => ({
      id: b.id,
      title: b.title || b.url,
      url: b.url,
      description: b.description || '',
      group: b.group || 'Unsorted',
      favicon: b.favicon || '',
      image: b.image || '',
      isPinned: !!b.isPinned,
      createdAt: b.createdAt || '',
    }));
    renderSearchGroupChips();
    return searchCatalog;
  } catch (err) {
    console.warn('[Markbel Popup] Failed to load search catalog:', err);
    return [];
  }
}

/**
 * Render Search Group Filter Chips
 */
export function renderSearchGroupChips(): void {
  if (typeof document === 'undefined') return;
  const searchGroupChips = document.getElementById('search-group-chips');
  if (!searchGroupChips) return;

  const groups = new Set<string>();
  for (const b of searchCatalog) {
    if (b.group && b.group.trim()) {
      groups.add(b.group.trim());
    }
  }

  const groupList = ['All', ...Array.from(groups).sort()];
  searchGroupChips.innerHTML = groupList
    .map(
      (g) =>
        `<button type="button" class="search-chip ${
          g.toLowerCase() === activeSearchGroup.toLowerCase() ? 'active' : ''
        }" data-group="${escapeHtml(g)}">${escapeHtml(g)}</button>`
    )
    .join('');
}

/**
 * Render Search Results List with Selection Highlight
 */
export function renderSearchResults(): void {
  if (typeof document === 'undefined') return;
  const inputSearchVault = document.getElementById('input-search-vault') as HTMLInputElement | null;
  const searchResultsList = document.getElementById('search-results-list');
  if (!searchResultsList) return;

  const query = inputSearchVault?.value || '';
  filteredResults = filterAndRankBookmarks(searchCatalog, query, activeSearchGroup);

  if (filteredResults.length === 0) {
    searchResultsList.innerHTML = `
      <div class="search-empty-state">
        <p>No bookmarks found matching "<strong>${escapeHtml(query)}</strong>"</p>
        <span style="font-size: 11px; opacity: 0.7;">Try searching by title, group, or domain</span>
      </div>
    `;
    return;
  }

  if (selectedResultIndex >= filteredResults.length) {
    selectedResultIndex = 0;
  }

  searchResultsList.innerHTML = filteredResults
    .map((item, idx) => {
      const isSelected = idx === selectedResultIndex;
      const initial = (item.title || item.url || '?').charAt(0).toUpperCase();
      const iconHtml = item.favicon
        ? `<img class="search-item-icon" src="${escapeHtml(item.favicon)}" alt="" />
           <div class="search-item-fallback-icon" style="display: none;">${escapeHtml(initial)}</div>`
        : `<div class="search-item-fallback-icon">${escapeHtml(initial)}</div>`;

      const domain = formatDomain(item.url);

      return `
        <div class="search-item ${isSelected ? 'selected' : ''}" data-index="${idx}" role="option" aria-selected="${isSelected}">
          ${iconHtml}
          <div class="search-item-info">
            <div class="search-item-header">
              <span class="search-item-title">${escapeHtml(item.title || item.url)}</span>
              ${item.isPinned ? `<span class="search-item-pin-badge" title="Pinned">★</span>` : ''}
              <span class="search-item-group">${escapeHtml(item.group || 'Unsorted')}</span>
            </div>
            <span class="search-item-url">${escapeHtml(domain)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  searchResultsList.querySelectorAll<HTMLImageElement>('img.search-item-icon').forEach((img) => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fallback = img.nextElementSibling as HTMLElement | null;
      if (fallback) fallback.style.display = 'flex';
    }, { once: true });
  });

  renderSelection();
}

/**
 * Update DOM element highlighting for selected search item
 */
export function renderSelection(): void {
  if (typeof document === 'undefined') return;
  const searchResultsList = document.getElementById('search-results-list');
  if (!searchResultsList) return;

  const items = searchResultsList.querySelectorAll<HTMLElement>('.search-item');
  items.forEach((el, idx) => {
    if (idx === selectedResultIndex) {
      el.classList.add('selected');
      el.setAttribute('aria-selected', 'true');
      el.scrollIntoView({ block: 'nearest' });
    } else {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
    }
  });
}

/**
 * Open Bookmark Action
 */
export async function openBookmark(item: SearchBookmarkItem, newTab: boolean, active: boolean): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;

  if (newTab) {
    await chrome.tabs.create({ url: item.url, active });
    if (active && typeof window !== 'undefined') window.close();
  } else {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    if (currentTab?.id) {
      await chrome.tabs.update(currentTab.id, { url: item.url });
    } else {
      await chrome.tabs.create({ url: item.url, active: true });
    }
    if (typeof window !== 'undefined') window.close();
  }
}

/**
 * Activate Search View (load catalog, render, focus input)
 */
export async function activateSearchView(): Promise<void> {
  if (typeof document === 'undefined') return;
  const inputSearchVault = document.getElementById('input-search-vault') as HTMLInputElement | null;

  await loadSearchCatalog();
  renderSearchResults();
  if (inputSearchVault) {
    inputSearchVault.focus();
    inputSearchVault.select();
  }
}

/**
 * Initialize Quick Open Search View event handlers
 */
export function initSearchView(): void {
  if (typeof document === 'undefined') return;

  const inputSearchVault = document.getElementById('input-search-vault') as HTMLInputElement | null;
  const btnSearchClear = document.getElementById('btn-search-clear') as HTMLButtonElement | null;
  const searchGroupChips = document.getElementById('search-group-chips');
  const searchResultsList = document.getElementById('search-results-list');

  // Input query change
  inputSearchVault?.addEventListener('input', () => {
    btnSearchClear?.classList.toggle('hidden', !inputSearchVault.value);
    selectedResultIndex = 0;
    renderSearchResults();
  });

  // Clear query button
  btnSearchClear?.addEventListener('click', () => {
    if (inputSearchVault) {
      inputSearchVault.value = '';
      btnSearchClear.classList.add('hidden');
      selectedResultIndex = 0;
      renderSearchResults();
      inputSearchVault.focus();
    }
  });

  // Search group chips click
  searchGroupChips?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.search-chip');
    if (!chip) return;
    const group = chip.getAttribute('data-group');
    if (group) {
      activeSearchGroup = group;
      searchGroupChips.querySelectorAll('.search-chip').forEach((c) => {
        c.classList.toggle('active', c.getAttribute('data-group') === group);
      });
      selectedResultIndex = 0;
      renderSearchResults();
    }
  });

  // Search keyboard navigation
  inputSearchVault?.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        selectedResultIndex = getNextSearchIndex(selectedResultIndex, filteredResults.length);
        renderSelection();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        selectedResultIndex = getPrevSearchIndex(selectedResultIndex, filteredResults.length);
        renderSelection();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults.length > 0 && filteredResults[selectedResultIndex]) {
        const selected = filteredResults[selectedResultIndex];
        const newTab = e.ctrlKey || e.metaKey || e.shiftKey;
        const active = !e.shiftKey;
        await openBookmark(selected, newTab, active);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof window !== 'undefined') window.close();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      if (window.getSelection()?.toString().trim()) {
        return; // Native copy of input selection
      }
      if (filteredResults[selectedResultIndex]) {
        e.preventDefault();
        await navigator.clipboard.writeText(filteredResults[selectedResultIndex].url);
        const originalPlaceholder = inputSearchVault.placeholder;
        inputSearchVault.placeholder = 'URL copied to clipboard!';
        setTimeout(() => {
          if (inputSearchVault) inputSearchVault.placeholder = originalPlaceholder;
        }, 1500);
      }
    }
  });

  // Search Results List Click
  searchResultsList?.addEventListener('click', (e) => {
    const itemEl = (e.target as HTMLElement).closest('.search-item');
    if (!itemEl) return;
    const idx = Number(itemEl.getAttribute('data-index'));
    if (!isNaN(idx) && filteredResults[idx]) {
      openBookmark(filteredResults[idx], e.ctrlKey || e.metaKey, !e.shiftKey);
    }
  });
}
