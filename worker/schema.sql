-- Cloudflare D1 SQL Schema for Markbel

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

-- Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT DEFAULT '',
    image TEXT DEFAULT '',
    group_name TEXT NOT NULL DEFAULT 'Unsorted',
    is_read INTEGER DEFAULT 0,
    read_at TEXT DEFAULT '',
    is_pinned INTEGER DEFAULT 0,
    remind_at TEXT DEFAULT '',
    is_archived INTEGER DEFAULT 0,
    archive_group TEXT DEFAULT '',
    version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT DEFAULT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'blue',
    version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT DEFAULT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sync Changes Table (Audit log for client pull cursor)
CREATE TABLE IF NOT EXISTS sync_changes (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    entity_version INTEGER NOT NULL,
    client_change_id TEXT NOT NULL,
    record_json TEXT,
    changed_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Devices Table (For Web Push and native device registry)
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'web',
    push_token TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, is_archived, deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_group ON bookmarks(user_id, group_name);
CREATE INDEX IF NOT EXISTS idx_groups_user ON groups(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_sync_changes_pull ON sync_changes(user_id, entity_type, sequence);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
