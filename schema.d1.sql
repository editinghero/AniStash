-- =====================================================================
-- OtakuList — Cloudflare D1 schema
-- =====================================================================
-- Apply with:
--   wrangler d1 execute <DB_NAME> --file=./schema.d1.sql              (local)
--   wrangler d1 execute <DB_NAME> --file=./schema.d1.sql --remote     (prod)
--
-- D1 is SQLite under the hood, so this uses SQLite syntax (no SERIAL,
-- no ENUM types, TEXT for ids, INTEGER for unix-ms timestamps, CHECK
-- constraints in place of enums).
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- users
-- One row per account. Auth strategy is up to you (Lucia + D1 sessions,
-- Cloudflare Access, Better-Auth, etc.). password_hash is NULL for
-- passwordless / OAuth-only accounts.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,             -- uuid / nanoid
  email           TEXT NOT NULL UNIQUE,
  email_verified  INTEGER NOT NULL DEFAULT 0,   -- 0/1
  display_name    TEXT,
  avatar_url      TEXT,
  password_hash   TEXT,                         -- argon2/bcrypt hash, nullable
  created_at      INTEGER NOT NULL,             -- unix ms
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------------------------------------------------------------------
-- sessions (only needed if you do server-side sessions)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                 -- random token id
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,                 -- unix ms
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ---------------------------------------------------------------------
-- media
-- Shared, deduped cache of AniList metadata. One row per AniList ID +
-- type. All users reference these rows so a single anime/manga isn't
-- duplicated per user.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  anilist_id        INTEGER NOT NULL,
  mal_id            INTEGER,                    -- AniList's idMal, nullable
  type              TEXT NOT NULL CHECK (type IN ('ANIME','MANGA')),
  format            TEXT,                       -- TV, MOVIE, OVA, MANGA, ...
  status            TEXT,                       -- FINISHED, RELEASING, ...
  title_romaji      TEXT,
  title_english     TEXT,
  title_native      TEXT,
  cover_image       TEXT,                       -- extraLarge / large URL
  banner_image      TEXT,
  genres_json       TEXT,                       -- JSON array of strings
  episodes          INTEGER,
  chapters          INTEGER,
  average_score     INTEGER,                    -- AniList 0-100
  mal_score         REAL,                       -- optional, from Jikan
  is_adult          INTEGER NOT NULL DEFAULT 0, -- 0/1
  age_rating        TEXT,                       -- derived, optional
  description       TEXT,
  start_year        INTEGER,
  season            TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  UNIQUE (anilist_id, type)
);

CREATE INDEX IF NOT EXISTS idx_media_anilist_id ON media(anilist_id);
CREATE INDEX IF NOT EXISTS idx_media_mal_id     ON media(mal_id);
CREATE INDEX IF NOT EXISTS idx_media_type       ON media(type);

-- ---------------------------------------------------------------------
-- user_media
-- The actual "list entry": ties a user to a media item with status,
-- progress, score, notes, and the original bookmark URL they pasted.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_media (
  id          TEXT PRIMARY KEY,                 -- uuid
  user_id     TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN
                ('WATCHING','COMPLETED','PLANNING','ON_HOLD','DROPPED')),
  progress    INTEGER NOT NULL DEFAULT 0,       -- ep or chapter count
  user_score  REAL,                             -- 0-10 personal rating
  notes       TEXT,
  source_url  TEXT,                             -- the URL the user pasted
  started_at  INTEGER,
  finished_at INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_user_media_user_id          ON user_media(user_id);
CREATE INDEX IF NOT EXISTS idx_user_media_user_status      ON user_media(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_media_user_updated_at  ON user_media(user_id, updated_at DESC);

-- ---------------------------------------------------------------------
-- user_settings
-- Per-user app preferences, including the user-supplied Gemini API key
-- and preferred model. We store these server-side so a user keeps their
-- settings across devices instead of re-pasting their key on every browser.
--
-- SECURITY: gemini_api_key is a secret. When you wire this up:
--   • Never return it to the client in plain text on list endpoints —
--     only on an explicit "reveal" action the user just triggered.
--   • Encrypt at rest with a server-side key (e.g. AES-GCM using a
--     secret from the Worker's `env`) so a DB dump alone can't leak keys.
--   • Mask it in the UI (show only the last 4 chars) once saved.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gemini_api_key   TEXT,                 -- encrypted ciphertext (recommended)
  gemini_model     TEXT DEFAULT 'gemini-2.5-flash',
  theme            TEXT DEFAULT 'dark',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

-- ---------------------------------------------------------------------
-- import_jobs (optional)
-- Track bookmark-parse jobs so you can show history / retry failures.
-- Useful if you later add batch import (paste many URLs at once).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_jobs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,
  detected_title  TEXT,
  detected_type   TEXT CHECK (detected_type IN ('ANIME','MANGA')),
  resolved_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  status          TEXT NOT NULL CHECK (status IN
                    ('PENDING','RESOLVED','NEEDS_REVIEW','FAILED'))
                  DEFAULT 'PENDING',
  ai_notes        TEXT,
  error           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status  ON import_jobs(status);
