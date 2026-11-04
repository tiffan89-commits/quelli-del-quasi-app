ALTER TABLE fanta.leagues DROP CONSTRAINT leagues_kind_check;
ALTER TABLE fanta.leagues ADD CONSTRAINT leagues_kind_check CHECK(kind IN('standard','pilot','random'));
ALTER TABLE fanta.leagues DROP CONSTRAINT leagues_max_members_check;
ALTER TABLE fanta.leagues ADD CONSTRAINT leagues_max_members_check CHECK(max_members BETWEEN 2 AND 20 AND (kind='random' OR max_members<=12));
ALTER TABLE fanta.leagues ADD COLUMN slips_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE fanta.creation_jobs(id text PRIMARY KEY,bar_id text UNIQUE NOT NULL,owner_uid text NOT NULL,size integer NOT NULL CHECK(size BETWEEN 2 AND 20),name text NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','ready','failed')),league_id text,error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER invalidate_read_cache AFTER INSERT OR UPDATE OR DELETE ON fanta.creation_jobs FOR EACH STATEMENT EXECUTE FUNCTION fanta.invalidate_read_cache();
-- Imported competitions must never be projected into Bar again.
UPDATE fanta.bar_links b SET active=false FROM fanta.leagues l WHERE l.id=b.fanta_league_id AND l.source_key IS NOT NULL;
UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',(SELECT coalesce(jsonb_agg(CASE WHEN EXISTS(SELECT 1 FROM fanta.bar_links b JOIN fanta.leagues n ON n.id=b.fanta_league_id WHERE b.bar_league_id=l->>'id' AND n.source_key IS NOT NULL) THEN l-ARRAY['nativeFantaLink','nativeFantaTeams']::text[] ELSE l END),'[]') FROM jsonb_array_elements(payload->'leagues') l)) WHERE id=1;
-- Explicitly selected obsolete B competition only. Shared accounts/catalog stay intact.
CREATE TEMP TABLE retired_b ON COMMIT DROP AS SELECT id FROM fanta.leagues WHERE id='fanta-lucas-b' OR lower(trim(name)) IN('lucas bar b','lucas bar lega b','fanta lucas bar lega b');
DELETE FROM fanta.reference_results WHERE matchup_id IN(SELECT id FROM fanta.matchups WHERE league_id IN(SELECT id FROM retired_b));
DELETE FROM fanta.results WHERE matchup_id IN(SELECT id FROM fanta.matchups WHERE league_id IN(SELECT id FROM retired_b));
DELETE FROM fanta.lineups WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.matchups WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.rounds WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.bar_links WHERE fanta_league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.competitions WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.auction_actions WHERE auction_id IN(SELECT id FROM fanta.auctions WHERE league_id IN(SELECT id FROM retired_b));
DELETE FROM fanta.lots WHERE auction_id IN(SELECT id FROM fanta.auctions WHERE league_id IN(SELECT id FROM retired_b));
DELETE FROM fanta.sales WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.auctions WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.rosters WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.roster_entries WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.player_bindings WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.roster_changes WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.pilot_claims WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.import_issues WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.teams WHERE league_id IN(SELECT id FROM retired_b);
DELETE FROM fanta.leagues WHERE id IN(SELECT id FROM retired_b);

WITH removed AS(SELECT l->>'id' AS id FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'leagues') l WHERE lower(trim(l->>'name')) IN('lucas bar b','lucas bar lega b','fanta lucas bar lega b'))
UPDATE fanta_state SET payload=jsonb_set(jsonb_set(jsonb_set(payload,'{leagues}',(SELECT coalesce(jsonb_agg(l),'[]') FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id' NOT IN(SELECT id FROM removed))),'{rounds}',(SELECT coalesce(jsonb_agg(r),'[]') FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'league' NOT IN(SELECT id FROM removed) AND coalesce(r#>>'{nativeFanta,leagueId}','') NOT IN(SELECT id FROM retired_b))),'{ledger}',(SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_array_elements(coalesce(payload->'ledger','[]')) x WHERE x->>'league' NOT IN(SELECT id FROM removed))) WHERE id=1;

UPDATE fanta_state SET payload=payload||jsonb_build_object('fantaAccessPolicy','native-coaches-v1') WHERE id=1;
-- Exact legacy B key verified on production: 35 rounds, one already refunded
-- and fully settled slip (stake 20, payout 20). Abort if new unpaid bets appear.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'rounds') r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r->'slips','[]')) s WHERE r->>'competitionKey'='fc:2026:1366161:730462' AND coalesce(s->>'creditsSettled','false')<>'true') THEN RAISE EXCEPTION 'Lucas Bar B contains an unpaid slip; reconcile before deleting'; END IF;
END $$;
CREATE TEMP TABLE retired_b_rounds ON COMMIT DROP AS SELECT r->>'id' AS id FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'rounds') r WHERE r->>'competitionKey'='fc:2026:1366161:730462';
UPDATE fanta_state SET payload=jsonb_set(jsonb_set(jsonb_set(payload,'{rounds}',(SELECT coalesce(jsonb_agg(r),'[]') FROM jsonb_array_elements(payload->'rounds') r WHERE coalesce(r->>'competitionKey','')<>'fc:2026:1366161:730462')),'{ledger}',(SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_array_elements(coalesce(payload->'ledger','[]')) x WHERE coalesce(x->>'round','') NOT IN(SELECT id FROM retired_b_rounds))),'{leagues}',(SELECT coalesce(jsonb_agg(l||jsonb_build_object('fantasyWalletScopes',coalesce(l->'fantasyWalletScopes','{}')-'fc:2026:1366161:730462','fantasyTeams',coalesce(l->'fantasyTeams','{}')-'fc:2026:1366161:730462','members',(SELECT jsonb_agg(m||jsonb_build_object('competitionPoints',coalesce(m->'competitionPoints','{}')-'fc:2026:1366161:730462','fantasyWallets',coalesce(m->'fantasyWallets','{}')-'fc:2026:1366161:730462','fantasyBalances',coalesce(m->'fantasyBalances','{}')-'fc:2026:1366161:730462')) FROM jsonb_array_elements(l->'members') m))),'[]') FROM jsonb_array_elements(payload->'leagues') l)) WHERE id=1;
DELETE FROM fanta.bar_assets WHERE competition_key='fc:2026:1366161:730462';
