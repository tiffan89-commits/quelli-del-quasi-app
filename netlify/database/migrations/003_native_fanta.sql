CREATE SCHEMA IF NOT EXISTS fanta;
CREATE TABLE IF NOT EXISTS fanta.clubs(id text PRIMARY KEY, api_id integer UNIQUE NOT NULL, name text NOT NULL);
CREATE TABLE IF NOT EXISTS fanta.players(id text PRIMARY KEY, api_id integer UNIQUE NOT NULL, club_id text REFERENCES fanta.clubs(id), name text NOT NULL, role text NOT NULL CHECK(role IN ('P','D','C','A')), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS fanta.fixtures(id text PRIMARY KEY, api_id integer UNIQUE NOT NULL, season integer NOT NULL, round integer NOT NULL, kickoff timestamptz, status text NOT NULL DEFAULT 'NS', home_id text REFERENCES fanta.clubs(id), away_id text REFERENCES fanta.clubs(id), data jsonb NOT NULL DEFAULT '{}', digest text, final_reads integer NOT NULL DEFAULT 0, checked_at timestamptz, frozen_at timestamptz);
CREATE INDEX IF NOT EXISTS fixtures_window ON fanta.fixtures(kickoff,status);
CREATE TABLE IF NOT EXISTS fanta.player_stats(fixture_id text REFERENCES fanta.fixtures(id), player_id text REFERENCES fanta.players(id), data jsonb NOT NULL, digest text NOT NULL, PRIMARY KEY(fixture_id,player_id));
CREATE TABLE IF NOT EXISTS fanta.events(fixture_id text REFERENCES fanta.fixtures(id), id text NOT NULL, data jsonb NOT NULL, seen_at timestamptz NOT NULL DEFAULT now(), notify boolean NOT NULL DEFAULT false, PRIMARY KEY(fixture_id,id));
CREATE TABLE IF NOT EXISTS fanta.baselines(id text PRIMARY KEY, model text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS fanta.votes(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, fixture_id text REFERENCES fanta.fixtures(id), player_id text REFERENCES fanta.players(id), version text NOT NULL, official boolean NOT NULL DEFAULT false, input_hash text NOT NULL, input jsonb NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(fixture_id,player_id,input_hash,official));
CREATE UNIQUE INDEX IF NOT EXISTS one_official_vote ON fanta.votes(fixture_id,player_id) WHERE official;
CREATE INDEX IF NOT EXISTS latest_votes ON fanta.votes(fixture_id,player_id,id DESC);
CREATE TABLE IF NOT EXISTS fanta.leagues(id text PRIMARY KEY, name text NOT NULL, season integer NOT NULL, admin_uid text NOT NULL, accent text NOT NULL DEFAULT '#d6f77b', max_members integer NOT NULL DEFAULT 12 CHECK(max_members BETWEEN 2 AND 12), invite_code text UNIQUE NOT NULL, rules jsonb NOT NULL, beta boolean NOT NULL DEFAULT true, source_key text UNIQUE);
CREATE TABLE IF NOT EXISTS fanta.teams(id text PRIMARY KEY, league_id text NOT NULL REFERENCES fanta.leagues(id), user_id text, name text NOT NULL, manager text NOT NULL, color text NOT NULL DEFAULT '#d6f77b', joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(league_id,user_id));
CREATE OR REPLACE FUNCTION fanta.limit_members() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM fanta.leagues WHERE id=NEW.league_id FOR UPDATE;
 IF (SELECT count(*) FROM fanta.teams WHERE league_id=NEW.league_id AND id<>NEW.id)>=(SELECT max_members FROM fanta.leagues WHERE id=NEW.league_id) THEN RAISE EXCEPTION 'Lega al completo' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fanta_member_limit ON fanta.teams;
CREATE TRIGGER fanta_member_limit BEFORE INSERT OR UPDATE OF league_id ON fanta.teams FOR EACH ROW EXECUTE FUNCTION fanta.limit_members();
CREATE TABLE IF NOT EXISTS fanta.rosters(league_id text REFERENCES fanta.leagues(id), team_id text REFERENCES fanta.teams(id), player_id text REFERENCES fanta.players(id), price integer NOT NULL CHECK(price>=0), PRIMARY KEY(league_id,player_id));
CREATE TABLE IF NOT EXISTS fanta.rounds(league_id text REFERENCES fanta.leagues(id), number integer CHECK(number BETWEEN 1 AND 38), seriea_round integer NOT NULL CHECK(seriea_round BETWEEN 1 AND 38), deadline timestamptz NOT NULL, official boolean NOT NULL DEFAULT false, PRIMARY KEY(league_id,number));
CREATE TABLE IF NOT EXISTS fanta.lineups(league_id text, round integer, team_id text REFERENCES fanta.teams(id), formation text NOT NULL, starters jsonb NOT NULL, bench jsonb NOT NULL, saved_at timestamptz NOT NULL DEFAULT now(), inherited_from integer, PRIMARY KEY(league_id,round,team_id), FOREIGN KEY(league_id,round) REFERENCES fanta.rounds(league_id,number));
CREATE TABLE IF NOT EXISTS fanta.matchups(id text PRIMARY KEY, league_id text, round integer, home_id text REFERENCES fanta.teams(id), away_id text REFERENCES fanta.teams(id), FOREIGN KEY(league_id,round) REFERENCES fanta.rounds(league_id,number), CHECK(home_id<>away_id), UNIQUE(league_id,round,home_id), UNIQUE(league_id,round,away_id));
CREATE TABLE IF NOT EXISTS fanta.results(matchup_id text PRIMARY KEY REFERENCES fanta.matchups(id), historical boolean NOT NULL DEFAULT false, official boolean NOT NULL DEFAULT false, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS fanta.auctions(id text PRIMARY KEY, league_id text UNIQUE NOT NULL REFERENCES fanta.leagues(id), version integer NOT NULL DEFAULT 1, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS fanta.lots(id text PRIMARY KEY, auction_id text REFERENCES fanta.auctions(id), player_id text REFERENCES fanta.players(id), ends_at timestamptz, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS fanta.auction_actions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, auction_id text REFERENCES fanta.auctions(id), lot_id text, actor text, kind text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS fanta.sales(id text PRIMARY KEY, auction_id text REFERENCES fanta.auctions(id), league_id text REFERENCES fanta.leagues(id), team_id text REFERENCES fanta.teams(id), player_id text REFERENCES fanta.players(id), price integer NOT NULL CHECK(price>0), undone boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS one_active_sale ON fanta.sales(league_id,player_id) WHERE NOT undone;
CREATE TABLE IF NOT EXISTS fanta.notification_settings(user_id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS fanta.notifications(id text PRIMARY KEY, user_id text NOT NULL, kind text NOT NULL, data jsonb NOT NULL, expires_at timestamptz NOT NULL, delivered_at timestamptz, attempts integer NOT NULL DEFAULT 0, lease_until timestamptz);
CREATE TABLE IF NOT EXISTS fanta.jobs(id text PRIMARY KEY, data jsonb NOT NULL, lease_until timestamptz);
CREATE TABLE IF NOT EXISTS fanta.import_issues(id text PRIMARY KEY, league_id text REFERENCES fanta.leagues(id), data jsonb NOT NULL);
-- Read-only migration evidence; deliberately excludes credentials, sessions and assets.
CREATE TABLE IF NOT EXISTS fanta.import_sources(id text PRIMARY KEY, owner_uid text NOT NULL, data jsonb NOT NULL, digest text NOT NULL, captured_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS fanta.reference_results(matchup_id text PRIMARY KEY REFERENCES fanta.matchups(id), data jsonb NOT NULL, digest text NOT NULL, captured_at timestamptz NOT NULL DEFAULT now());
