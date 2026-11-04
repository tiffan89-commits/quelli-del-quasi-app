CREATE TABLE IF NOT EXISTS football_player_catalog (
  season text NOT NULL,
  team text NOT NULL,
  player_id text NOT NULL,
  metadata jsonb NOT NULL,
  PRIMARY KEY (season, team, player_id)
);
CREATE INDEX IF NOT EXISTS football_player_catalog_team ON football_player_catalog(team);
CREATE TABLE IF NOT EXISTS football_player_images (
  player_id text NOT NULL,
  digest text NOT NULL,
  mime text NOT NULL,
  data bytea NOT NULL,
  PRIMARY KEY (player_id, digest)
);
