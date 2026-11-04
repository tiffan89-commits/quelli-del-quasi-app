-- Fail closed if an old importer is still writing, or the native Lucas archive
-- has not been populated. No external requests and no destructive fallback.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(coalesce(payload->'fantasyConnections','[]')) c WHERE jsonb_typeof(c->'lease')='number' AND (c->>'lease')::numeric>extract(epoch FROM now())*1000) THEN RAISE EXCEPTION 'Attendere la fine del vecchio import prima del passaggio nativo'; END IF;
 IF EXISTS(SELECT 1 FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(coalesce(payload->'fantasyConnections','[]')) c WHERE c->>'alias'='lucas-bar' AND c->>'competitionId'='548867') AND NOT EXISTS(SELECT 1 FROM fanta.leagues l WHERE l.source_key='lucas-bar:548867' AND EXISTS(SELECT 1 FROM fanta.rosters r WHERE r.league_id=l.id) AND EXISTS(SELECT 1 FROM fanta.rounds r WHERE r.league_id=l.id)) THEN RAISE EXCEPTION 'Archivio Lucas nativo incompleto: conservati tutti i dati precedenti'; END IF;
END $$;
ALTER TABLE fanta.leagues ADD COLUMN kind text NOT NULL DEFAULT 'standard' CHECK(kind IN('standard','pilot'));
ALTER TABLE fanta.leagues ADD COLUMN pilot_number int UNIQUE;
ALTER TABLE fanta.leagues ADD COLUMN auto_lineups_from timestamptz;
ALTER TABLE fanta.leagues ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE fanta.teams ADD COLUMN credit_adjustment int NOT NULL DEFAULT 0;
ALTER TABLE fanta.teams ADD COLUMN coach_name text;
ALTER TABLE fanta.sales ADD COLUMN released boolean NOT NULL DEFAULT false;
DROP INDEX fanta.one_active_sale;
CREATE UNIQUE INDEX one_active_sale ON fanta.sales(league_id,player_id) WHERE NOT undone AND NOT released;
CREATE TABLE fanta.pilot_claims(user_id text PRIMARY KEY,league_id text NOT NULL REFERENCES fanta.leagues(id),team_id text NOT NULL UNIQUE REFERENCES fanta.teams(id),claimed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE fanta.roster_changes(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,league_id text NOT NULL REFERENCES fanta.leagues(id),actor text NOT NULL,kind text NOT NULL,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE fanta.cutover_archive(id text PRIMARY KEY,data jsonb NOT NULL,captured_at timestamptz NOT NULL DEFAULT now(),restored_at timestamptz);
CREATE TABLE fanta.bar_links(bar_league_id text PRIMARY KEY,fanta_league_id text NOT NULL REFERENCES fanta.leagues(id),competition_id text NOT NULL REFERENCES fanta.competitions(id),competition_key text NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
-- Explicit owner approval in chat: refund this one outstanding retired round.
-- No other round is selected implicitly, including bets saved after the review.
INSERT INTO fanta.jobs(id,data) VALUES('native-cutover:approved-refunds',jsonb_build_object('roundIds',jsonb_build_array('212325cd2bbd3b3d435a2178'),'reason','Import dismesso · annullamento e rimborso autorizzati')) ON CONFLICT DO NOTHING;
-- Immutable evidence and encrypted credentials remain archived, never returned
-- to the client. No users, sessions, balances, slips or historical rounds change.
INSERT INTO fanta.cutover_archive(id,data) SELECT 'native-cutover-v1',jsonb_build_object('connections',coalesce(payload->'fantasyConnections','[]'::jsonb),'attempts',coalesce(payload->'fantasyAttempts','[]'::jsonb),'leagues',payload->'leagues','rounds',payload->'rounds') FROM fanta_state WHERE id=1 ON CONFLICT DO NOTHING;
CREATE TABLE fanta.bar_assets(league_id text NOT NULL,competition_key text NOT NULL,team_id text NOT NULL,kind text NOT NULL CHECK(kind IN('logo','shirt')),data jsonb NOT NULL,PRIMARY KEY(league_id,competition_key,team_id,kind));
INSERT INTO fanta.bar_assets SELECT lid,x->>'competitionKey',t.key,k.key,k.value-'source' FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(coalesce(payload->'fantasyConnections','[]')) x CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(x->'leagues','[]')) lid CROSS JOIN LATERAL jsonb_each(coalesce(x->'teamAssets','{}')) t CROSS JOIN LATERAL jsonb_each(t.value) k WHERE k.key IN('logo','shirt') AND k.value?'data' AND x->>'competitionKey' IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key)
 SELECT DISTINCT lid,l.id,l.id||':main',x->>'competitionKey' FROM fanta_state s
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.payload->'fantasyConnections','[]'::jsonb)) x
 CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(x->'leagues','[]'::jsonb)) lid
 JOIN fanta.leagues l ON l.source_key=(x->>'alias')||':'||(x->>'competitionId')
 WHERE l.source_key='lucas-bar:548867' AND x->>'competitionKey' IS NOT NULL ON CONFLICT DO NOTHING;
UPDATE fanta.leagues SET auto_lineups_from=now() WHERE source_key='lucas-bar:548867';
-- Every existing association becomes permanent before current rosters can move.
INSERT INTO fanta.player_bindings(league_id,team_id,source_key,player_id,imported_name,aliases,evidence)
 SELECT league_id,team_id,source_id,player_id,coalesce(data->>'originalName',name),jsonb_build_array(name,coalesce(data->>'originalName',name)),jsonb_build_object('sourceIds',coalesce(data->'aliases','[]'::jsonb),'source','preserved-roster') FROM fanta.roster_entries WHERE player_id IS NOT NULL ON CONFLICT DO NOTHING;
UPDATE fanta_state SET payload=payload-ARRAY['fantasyConnections','fantasyAttempts']::text[] WHERE id=1 AND payload?'fantasyConnections';
CREATE TRIGGER invalidate_read_cache AFTER INSERT OR UPDATE OR DELETE ON fanta.pilot_claims FOR EACH STATEMENT EXECUTE FUNCTION fanta.invalidate_read_cache();
CREATE TRIGGER invalidate_read_cache AFTER INSERT OR UPDATE OR DELETE ON fanta.roster_changes FOR EACH STATEMENT EXECUTE FUNCTION fanta.invalidate_read_cache();
CREATE TRIGGER invalidate_read_cache AFTER INSERT OR UPDATE OR DELETE ON fanta.bar_links FOR EACH STATEMENT EXECUTE FUNCTION fanta.invalidate_read_cache();
