CREATE TABLE IF NOT EXISTS dayamora.outfits (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES dayamora.users(id),
 name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
 manifest TEXT NOT NULL CHECK (octet_length(manifest)<131072),
 snapshot_url TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at BIGINT NOT NULL,
 updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS outfits_user_updated ON dayamora.outfits(user_id,updated_at DESC);
REVOKE ALL ON TABLE dayamora.outfits FROM PUBLIC;
