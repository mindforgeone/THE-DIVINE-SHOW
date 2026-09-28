CREATE TABLE IF NOT EXISTS user_state (
  uid TEXT NOT NULL,
  resource TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (uid, resource)
);
