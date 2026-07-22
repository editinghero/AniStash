-- Repairs databases created while user_media still referenced media_old.
-- This copy-and-replace operation preserves every existing library row while
-- replacing only the broken child table. It does not touch users, settings,
-- sessions, or media. It intentionally avoids BEGIN/COMMIT because Wrangler's
-- local D1 runner rejects explicit transaction statements in SQL files.

CREATE TABLE user_media_repaired (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id        INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN (
                    'WATCHING', 'COMPLETED', 'PLANNING', 'ON_HOLD', 'DROPPED'
                  )),
  progress        INTEGER NOT NULL DEFAULT 0,
  user_score      REAL,
  notes           TEXT,
  source_url      TEXT,
  started_at      INTEGER,
  finished_at     INTEGER,
  ai_chat_history TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE (user_id, media_id)
);

INSERT INTO user_media_repaired (
  id, user_id, media_id, status, progress, user_score, notes, source_url,
  started_at, finished_at, ai_chat_history, created_at, updated_at
)
SELECT
  id, user_id, media_id, status, progress, user_score, notes, source_url,
  started_at, finished_at, ai_chat_history, created_at, updated_at
FROM user_media;

DROP TABLE user_media;
ALTER TABLE user_media_repaired RENAME TO user_media;

CREATE INDEX idx_user_media_user_id ON user_media(user_id);
CREATE INDEX idx_user_media_user_status ON user_media(user_id, status);
CREATE INDEX idx_user_media_user_updated_at
  ON user_media(user_id, updated_at DESC);
