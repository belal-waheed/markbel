/**
 * Markbel TickTick Integration Engine
 * Authenticated two-way synchronization between Markbel bookmarks and TickTick tasks via TickTick Open API v1.
 */

import { LocalBookmark } from '../db/db';

export const TICKTICK_API_BASE = 'https://api.ticktick.com/open/v1';

export interface TickTickProject {
  id: string;
  name: string;
  color?: string;
  closed?: boolean;
  viewMode?: string;
  sortOrder?: number;
}

export interface TickTickTask {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  isAllDay?: boolean;
  priority?: number;
  status?: number; // 0 = normal, 2 = completed
  completedTime?: string;
}

export interface TickTickConfig {
  token: string;
  projectId?: string;
  enabled: boolean;
}

const STORAGE_KEY_TOKEN = 'markbel_ticktick_token';
const STORAGE_KEY_PROJECT = 'markbel_ticktick_project_id';
const STORAGE_KEY_ENABLED = 'markbel_ticktick_enabled';

function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return null;
}

/**
 * Reads persisted TickTick configuration from local storage
 */
export function getStoredTickTickConfig(): TickTickConfig {
  const storage = getLocalStorage();
  if (!storage) {
    return { token: '', projectId: '', enabled: false };
  }
  return {
    token: storage.getItem(STORAGE_KEY_TOKEN) || '',
    projectId: storage.getItem(STORAGE_KEY_PROJECT) || '',
    enabled: storage.getItem(STORAGE_KEY_ENABLED) === 'true',
  };
}

/**
 * Persists TickTick configuration to local storage
 */
export function setStoredTickTickConfig(config: Partial<TickTickConfig>): void {
  const storage = getLocalStorage();
  if (!storage) return;
  if (config.token !== undefined) {
    storage.setItem(STORAGE_KEY_TOKEN, config.token.trim());
  }
  if (config.projectId !== undefined) {
    storage.setItem(STORAGE_KEY_PROJECT, config.projectId.trim());
  }
  if (config.enabled !== undefined) {
    storage.setItem(STORAGE_KEY_ENABLED, String(config.enabled));
  }
}

/**
 * Fetches all user projects from TickTick Open API
 */
export async function getTickTickProjects(token: string): Promise<TickTickProject[]> {
  if (!token || !token.trim()) {
    throw new Error('TickTick API token is required');
  }

  const response = await fetch(`${TICKTICK_API_BASE}/project`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to fetch TickTick projects (${response.status}): ${errorText || response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Creates a new task in TickTick for a Markbel bookmark
 */
export async function createTickTickTask(
  token: string,
  bookmark: LocalBookmark,
  projectId?: string
): Promise<TickTickTask> {
  if (!token || !token.trim()) {
    throw new Error('TickTick API token is required');
  }

  const payload: Record<string, any> = {
    title: bookmark.title || bookmark.url,
    content: bookmark.url + (bookmark.description ? `\n\n${bookmark.description}` : ''),
  };

  const effectiveProject = projectId || bookmark.ticktickProjectId;
  if (effectiveProject) {
    payload.projectId = effectiveProject;
  }

  if (bookmark.remindAt) {
    try {
      payload.dueDate = new Date(bookmark.remindAt).toISOString().replace(/\.\d{3}Z$/, '+0000');
    } catch {}
  }

  const response = await fetch(`${TICKTICK_API_BASE}/task`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to create TickTick task (${response.status}): ${errorText || response.statusText}`);
  }

  return (await response.json()) as TickTickTask;
}

/**
 * Marks a task complete in TickTick
 */
export async function completeTickTickTask(
  token: string,
  taskId: string,
  projectId?: string
): Promise<{ success: boolean }> {
  if (!token || !token.trim()) {
    throw new Error('TickTick API token is required');
  }
  if (!taskId) {
    throw new Error('TickTick taskId is required');
  }

  // TickTick API provides project-scoped completion: /project/{projectId}/task/{taskId}/complete
  const url = projectId
    ? `${TICKTICK_API_BASE}/project/${projectId}/task/${taskId}/complete`
    : `${TICKTICK_API_BASE}/task/${taskId}/complete`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
    },
  });

  // If 404 with project endpoint, retry directly with general task endpoint
  if (!response.ok && projectId && response.status === 404) {
    const fallbackResponse = await fetch(`${TICKTICK_API_BASE}/task/${taskId}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
      },
    });
    if (fallbackResponse.ok) {
      return { success: true };
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to complete TickTick task (${response.status}): ${errorText || response.statusText}`);
  }

  return { success: true };
}

/**
 * Updates an existing task in TickTick
 */
export async function updateTickTickTask(
  token: string,
  taskId: string,
  bookmark: LocalBookmark,
  projectId?: string
): Promise<TickTickTask> {
  if (!token || !token.trim()) {
    throw new Error('TickTick API token is required');
  }
  if (!taskId) {
    throw new Error('TickTick taskId is required');
  }

  const payload: Record<string, any> = {
    id: taskId,
    title: bookmark.title || bookmark.url,
    content: bookmark.url + (bookmark.description ? `\n\n${bookmark.description}` : ''),
  };

  const effectiveProject = projectId || bookmark.ticktickProjectId;
  if (effectiveProject) {
    payload.projectId = effectiveProject;
  }

  if (bookmark.remindAt) {
    try {
      payload.dueDate = new Date(bookmark.remindAt).toISOString().replace(/\.\d{3}Z$/, '+0000');
    } catch {}
  }

  const response = await fetch(`${TICKTICK_API_BASE}/task/${taskId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to update TickTick task (${response.status}): ${errorText || response.statusText}`);
  }

  return (await response.json()) as TickTickTask;
}

/**
 * Handles two-way sync for a single bookmark when marked as read
 */
export async function syncCompletedBookmarkToTickTick(
  bookmark: LocalBookmark,
  overrideConfig?: { token: string; projectId?: string }
): Promise<Partial<LocalBookmark>> {
  const config = overrideConfig || getStoredTickTickConfig();
  if (!config.token || !bookmark.ticktickTaskId) {
    return {};
  }

  try {
    await completeTickTickTask(
      config.token,
      bookmark.ticktickTaskId,
      bookmark.ticktickProjectId || config.projectId
    );
    return {
      ticktickSyncStatus: 'synced',
    };
  } catch (err) {
    console.warn('[TickTick Sync Error]: Failed to complete task:', err);
    return {
      ticktickSyncStatus: 'failed',
    };
  }
}

/**
 * Handles creation or sync of a bookmark to TickTick
 */
export async function syncBookmarkToTickTick(
  bookmark: LocalBookmark,
  overrideConfig?: { token: string; projectId?: string }
): Promise<Partial<LocalBookmark>> {
  const config = overrideConfig || getStoredTickTickConfig();
  if (!config.token) return {};

  try {
    if (bookmark.ticktickTaskId) {
      const task = await updateTickTickTask(
        config.token,
        bookmark.ticktickTaskId,
        bookmark,
        config.projectId
      );
      return {
        ticktickTaskId: task.id,
        ticktickProjectId: task.projectId || config.projectId || null,
        ticktickSyncStatus: 'synced',
      };
    } else {
      const task = await createTickTickTask(config.token, bookmark, config.projectId);
      return {
        ticktickTaskId: task.id,
        ticktickProjectId: task.projectId || config.projectId || null,
        ticktickSyncStatus: 'synced',
      };
    }
  } catch (err) {
    console.warn('[TickTick Sync Error]: Failed to push bookmark:', err);
    return {
      ticktickSyncStatus: 'failed',
    };
  }
}
