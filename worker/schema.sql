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
    favicon TEXT DEFAULT '',
    site_name TEXT DEFAULT '',
    author TEXT DEFAULT '',
    published_at TEXT DEFAULT '',
    content_type TEXT DEFAULT 'website',
    reading_time INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    canonical_url TEXT DEFAULT '',
    article_content TEXT DEFAULT '',
    is_broken INTEGER DEFAULT 0,
    http_status INTEGER DEFAULT NULL,
    last_checked_at TEXT DEFAULT NULL,
    group_name TEXT NOT NULL DEFAULT 'Unsorted',
    is_read INTEGER DEFAULT 0,
    read_at TEXT DEFAULT '',
    is_pinned INTEGER DEFAULT 0,
    remind_at TEXT DEFAULT '',
    notified_at TEXT DEFAULT NULL,
    is_archived INTEGER DEFAULT 0,
    archive_group TEXT DEFAULT '',
    actor_type TEXT DEFAULT 'user',
    actor_name TEXT DEFAULT '',
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
    actor_type TEXT DEFAULT 'user',
    actor_name TEXT DEFAULT '',
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

-- Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
);

-- API Access Tokens Table (Personal Access Tokens & Agent Integrations)
CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    scopes TEXT NOT NULL,
    expires_at TEXT DEFAULT NULL,
    last_used_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Settings Table (Agent Preferences, Custom Rules & Workflow Configurations)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    rules_json TEXT DEFAULT '[]',
    preferences_json TEXT DEFAULT '{}',
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Vault Collaborators Table (Full Vault Peer Sharing & Permissions)
CREATE TABLE IF NOT EXISTS vault_collaborators (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    collaborator_user_id TEXT DEFAULT NULL,
    collaborator_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer', -- 'viewer' | 'editor'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted'
    invite_token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT DEFAULT NULL,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, is_archived, deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_group ON bookmarks(user_id, group_name);
CREATE INDEX IF NOT EXISTS idx_groups_user ON groups(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_sync_changes_pull ON sync_changes(user_id, entity_type, sequence);
CREATE INDEX IF NOT EXISTS idx_sync_changes_client_id ON sync_changes(client_change_id);
CREATE INDEX IF NOT EXISTS idx_sync_changes_user_seq ON sync_changes(user_id, sequence);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
CREATE INDEX IF NOT EXISTS idx_api_tokens_lookup ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_collab_owner ON vault_collaborators(owner_id);
CREATE INDEX IF NOT EXISTS idx_vault_collab_user ON vault_collaborators(collaborator_user_id);
CREATE INDEX IF NOT EXISTS idx_vault_collab_token ON vault_collaborators(invite_token);
CREATE INDEX IF NOT EXISTS idx_bookmarks_link_health ON bookmarks(deleted_at, last_checked_at);

-- Full-Text Search Virtual Table (FTS5) & Automatic Sync Triggers
CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
    id UNINDEXED,
    user_id UNINDEXED,
    title,
    description,
    site_name,
    article_content,
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
    INSERT INTO bookmarks_fts (id, user_id, title, description, site_name, article_content)
    VALUES (new.id, new.user_id, new.title, new.description, new.site_name, COALESCE(new.article_content, ''));
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
    DELETE FROM bookmarks_fts WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
    DELETE FROM bookmarks_fts WHERE id = old.id;
    INSERT INTO bookmarks_fts (id, user_id, title, description, site_name, article_content)
    SELECT new.id, new.user_id, new.title, new.description, new.site_name, COALESCE(new.article_content, '')
    WHERE new.deleted_at IS NULL;
END;


