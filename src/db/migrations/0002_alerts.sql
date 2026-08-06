-- Tracks whether a 24-hour overdue alert has been sent for this application.
ALTER TABLE applications ADD COLUMN alerted_overdue INTEGER NOT NULL DEFAULT 0;
