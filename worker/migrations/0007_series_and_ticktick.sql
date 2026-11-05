-- Migration 0007: Series progression and TickTick two-way integration columns
ALTER TABLE bookmarks ADD COLUMN series_key TEXT DEFAULT NULL;
ALTER TABLE bookmarks ADD COLUMN series_episode INTEGER DEFAULT NULL;
ALTER TABLE bookmarks ADD COLUMN series_season INTEGER DEFAULT NULL;
ALTER TABLE bookmarks ADD COLUMN series_history TEXT DEFAULT NULL;
ALTER TABLE bookmarks ADD COLUMN ticktick_task_id TEXT DEFAULT NULL;
ALTER TABLE bookmarks ADD COLUMN ticktick_project_id TEXT DEFAULT NULL;
ALTER TABLE bookmarks ADD COLUMN ticktick_sync_status TEXT DEFAULT NULL;
