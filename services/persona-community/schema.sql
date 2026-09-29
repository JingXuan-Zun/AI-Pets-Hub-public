CREATE TABLE IF NOT EXISTS persona_request_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 1),
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS persona_limits_expiry ON persona_request_limits(window_start);
