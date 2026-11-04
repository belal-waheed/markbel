-- Migration 0005: Full-Text Search (SQLite FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
    id UNINDEXED,
    user_id UNINDEXED,
    title,
    description,
    site_name,
    article_content,
    tokenize = 'unicode61 remove_diacritics 2'
);

-- Backfill existing data
INSERT INTO bookmarks_fts (id, user_id, title, description, site_name, article_content)
SELECT id, user_id, title, description, site_name, COALESCE(article_content, '')
FROM bookmarks
WHERE deleted_at IS NULL;

-- Sync triggers
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
    VALUES (new.id, new.user_id, new.title, new.description, new.site_name, COALESCE(new.article_content, ''));
END;
