CREATE TABLE IF NOT EXISTS fanta.competitions(
 id text PRIMARY KEY,league_id text NOT NULL REFERENCES fanta.leagues(id),
 name text NOT NULL,kind text NOT NULL DEFAULT 'league' CHECK(kind IN('league','groups','knockout')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','finished')),
 start_round integer CHECK(start_round BETWEEN 1 AND 38),data jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO fanta.competitions(id,league_id,name,status,start_round)
 SELECT l.id||':main',l.id,'Campionato',CASE WHEN EXISTS(SELECT 1 FROM fanta.rounds r WHERE r.league_id=l.id AND r.official) THEN 'active' ELSE 'draft' END,(SELECT min(seriea_round) FROM fanta.rounds r WHERE r.league_id=l.id) FROM fanta.leagues l ON CONFLICT DO NOTHING;
UPDATE fanta.leagues l SET max_members=(SELECT count(*) FROM fanta.teams t WHERE t.league_id=l.id)
 WHERE l.source_key='lucas-bar:548867' AND (SELECT count(*) FROM fanta.teams t WHERE t.league_id=l.id)=10;
ALTER TABLE fanta.rounds ADD COLUMN IF NOT EXISTS competition_id text NOT NULL DEFAULT '';
ALTER TABLE fanta.rounds ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}';
ALTER TABLE fanta.lineups ADD COLUMN IF NOT EXISTS competition_id text NOT NULL DEFAULT '';
ALTER TABLE fanta.matchups ADD COLUMN IF NOT EXISTS competition_id text NOT NULL DEFAULT '';
ALTER TABLE fanta.matchups ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}';
UPDATE fanta.rounds SET competition_id=league_id||':main' WHERE competition_id='';
UPDATE fanta.lineups SET competition_id=league_id||':main' WHERE competition_id='';
UPDATE fanta.matchups SET competition_id=league_id||':main' WHERE competition_id='';
ALTER TABLE fanta.lineups DROP CONSTRAINT IF EXISTS lineups_league_id_round_fkey;
ALTER TABLE fanta.matchups DROP CONSTRAINT IF EXISTS matchups_league_id_round_fkey;
ALTER TABLE fanta.matchups DROP CONSTRAINT IF EXISTS matchups_league_id_round_home_id_key;
ALTER TABLE fanta.matchups DROP CONSTRAINT IF EXISTS matchups_league_id_round_away_id_key;
ALTER TABLE fanta.lineups DROP CONSTRAINT IF EXISTS lineups_pkey;
ALTER TABLE fanta.rounds DROP CONSTRAINT IF EXISTS rounds_pkey;
ALTER TABLE fanta.rounds ADD PRIMARY KEY(competition_id,number);
ALTER TABLE fanta.lineups ADD PRIMARY KEY(competition_id,round,team_id);
ALTER TABLE fanta.rounds ADD FOREIGN KEY(competition_id) REFERENCES fanta.competitions(id);
ALTER TABLE fanta.lineups ADD FOREIGN KEY(competition_id,round) REFERENCES fanta.rounds(competition_id,number);
ALTER TABLE fanta.matchups ADD FOREIGN KEY(competition_id,round) REFERENCES fanta.rounds(competition_id,number);
ALTER TABLE fanta.matchups ADD UNIQUE(competition_id,round,home_id);
ALTER TABLE fanta.matchups ADD UNIQUE(competition_id,round,away_id);
CREATE OR REPLACE FUNCTION fanta.competition_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.competition_id='' THEN
  NEW.competition_id:=NEW.league_id||':main';
  INSERT INTO fanta.competitions(id,league_id,name) VALUES(NEW.competition_id,NEW.league_id,'Campionato') ON CONFLICT DO NOTHING;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM fanta.competitions c WHERE c.id=NEW.competition_id AND c.league_id=NEW.league_id) THEN RAISE EXCEPTION 'Competizione di un’altra lega' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER competition_round_scope BEFORE INSERT OR UPDATE OF competition_id,league_id ON fanta.rounds FOR EACH ROW EXECUTE FUNCTION fanta.competition_scope();
CREATE TRIGGER competition_lineup_scope BEFORE INSERT OR UPDATE OF competition_id,league_id ON fanta.lineups FOR EACH ROW EXECUTE FUNCTION fanta.competition_scope();
CREATE TRIGGER competition_matchup_scope BEFORE INSERT OR UPDATE OF competition_id,league_id ON fanta.matchups FOR EACH ROW EXECUTE FUNCTION fanta.competition_scope();
