-- Tracks whether a 72-hour overdue alert has been sent for this application.
ALTER TABLE applications ADD COLUMN alerted_overdue INTEGER NOT NULL DEFAULT 0;
