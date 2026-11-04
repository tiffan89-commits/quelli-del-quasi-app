-- Persist imported identities independently of mutable catalog snapshots.
CREATE TABLE IF NOT EXISTS fanta.player_bindings (
 league_id text NOT NULL REFERENCES fanta.leagues(id) ON DELETE CASCADE,
 team_id text NOT NULL REFERENCES fanta.teams(id) ON DELETE CASCADE,
 source_key text NOT NULL,
 player_id text NOT NULL REFERENCES fanta.players(id),
 imported_name text NOT NULL,
 aliases jsonb NOT NULL DEFAULT '[]',
 evidence jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(team_id,source_key)
);
-- One tiny version read replaces repeated transmission of the entire league.
CREATE TABLE IF NOT EXISTS fanta.cache_revision(id int PRIMARY KEY CHECK(id=1),revision bigint NOT NULL DEFAULT 1);
INSERT INTO fanta.cache_revision VALUES(1,1) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION fanta.invalidate_read_cache() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE fanta.cache_revision SET revision=revision+1 WHERE id=1;
 RETURN NULL;
END $$;
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['leagues','teams','clubs','players','rosters','roster_entries','player_bindings','auctions','competitions','rounds','matchups','results','reference_results','lineups','fixtures','votes','jobs'] LOOP
  EXECUTE format('CREATE TRIGGER invalidate_read_cache AFTER INSERT OR UPDATE OR DELETE ON fanta.%I FOR EACH STATEMENT EXECUTE FUNCTION fanta.invalidate_read_cache()',table_name);
 END LOOP;
END $$;
