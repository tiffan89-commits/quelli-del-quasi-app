ALTER TABLE fanta.teams ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS fanta.team_logos(
 team_id text PRIMARY KEY REFERENCES fanta.teams(id) ON DELETE CASCADE,
 data bytea NOT NULL CHECK(octet_length(data)<=256000),
 mime text NOT NULL CHECK(mime IN('image/png','image/jpeg','image/webp')),
 digest text NOT NULL
);
