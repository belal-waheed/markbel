-- Migration 0006: Background Link Health & 404 Rot Detection
ALTER TABLE bookmarks ADD COLUMN is_broken INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN http_status INTEGER DEFAULT NULL;
ALTER TABLE bookmarks ADD COLUMN last_checked_at TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_link_health ON bookmarks(deleted_at, last_checked_at);
