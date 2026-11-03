-- Migration 0004: Vault Collaboration and Actor Attribution
ALTER TABLE bookmarks ADD COLUMN actor_type TEXT DEFAULT 'user';
ALTER TABLE bookmarks ADD COLUMN actor_name TEXT DEFAULT '';
ALTER TABLE sync_changes ADD COLUMN actor_type TEXT DEFAULT 'user';
ALTER TABLE sync_changes ADD COLUMN actor_name TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS vault_collaborators (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    collaborator_user_id TEXT DEFAULT NULL,
    collaborator_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'pending',
    invite_token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT DEFAULT NULL,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_collab_owner ON vault_collaborators(owner_id);
CREATE INDEX IF NOT EXISTS idx_vault_collab_user ON vault_collaborators(collaborator_user_id);
CREATE INDEX IF NOT EXISTS idx_vault_collab_token ON vault_collaborators(invite_token);
