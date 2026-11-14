CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY NOT NULL,
  host_key TEXT UNIQUE NOT NULL,
  data TEXT NOT NULL,
  generation INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rooms_expiry ON rooms (expires_at);
