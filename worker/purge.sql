-- Cloudflare D1 Complete Data Purge Script for Markbel
DELETE FROM sync_changes;
DELETE FROM bookmarks;
DELETE FROM groups;
DELETE FROM devices;
DELETE FROM password_resets;
DELETE FROM users;
DELETE FROM sqlite_sequence WHERE name = 'sync_changes';
