-- Incidents ("病例", 2026-11-18): run once on the D1 database bound as RATE_DB
-- (persona-community-limits). Private: only the service reads it, and its read routes need ADMIN_TOKEN.
CREATE TABLE IF NOT EXISTS incident_groups (
  fingerprint TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  frames TEXT NOT NULL,
  versions TEXT NOT NULL,
  oses TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  reporters INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  fixed_in TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS incident_groups_last_seen ON incident_groups(last_seen);
-- One row per computer and problem; reporter is a salted hash of the app's random install id.
CREATE TABLE IF NOT EXISTS incident_reporters (
  fingerprint TEXT NOT NULL,
  reporter TEXT NOT NULL,
  PRIMARY KEY (fingerprint, reporter)
);
