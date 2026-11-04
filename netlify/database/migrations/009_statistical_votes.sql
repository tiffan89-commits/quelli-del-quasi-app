-- Append-only vote revisions: official means this was a final calculation, not that it can erase later corrections.
ALTER TABLE fanta.fixtures ADD COLUMN IF NOT EXISTS vote_model_key text;
ALTER TABLE fanta.fixtures ADD COLUMN IF NOT EXISTS vote_rebuild_key text;
ALTER TABLE fanta.fixtures ADD COLUMN IF NOT EXISTS vote_rebuilt_at timestamptz;
ALTER TABLE fanta.votes ADD COLUMN IF NOT EXISTS model_key text NOT NULL DEFAULT 'legacy';
ALTER TABLE fanta.votes ADD COLUMN IF NOT EXISTS supersedes_id bigint REFERENCES fanta.votes(id);
ALTER TABLE fanta.votes ADD COLUMN IF NOT EXISTS calculated_at timestamptz NOT NULL DEFAULT now();
DROP INDEX IF EXISTS fanta.one_official_vote;
ALTER TABLE fanta.votes DROP CONSTRAINT IF EXISTS votes_fixture_id_player_id_input_hash_official_key;
CREATE INDEX IF NOT EXISTS latest_model_votes ON fanta.votes(fixture_id,player_id,model_key,id DESC);
-- A live vote is a current snapshot; final votes and official corrections are immutable revisions.
CREATE UNIQUE INDEX IF NOT EXISTS current_live_vote ON fanta.votes(fixture_id,player_id,model_key) WHERE NOT official AND model_key<>'legacy';
CREATE UNIQUE INDEX IF NOT EXISTS official_vote_revisions ON fanta.votes(fixture_id,player_id,model_key,input_hash,coalesce(supersedes_id,0)) WHERE official AND model_key<>'legacy';
CREATE TABLE IF NOT EXISTS fanta.vote_odds_snapshots(
 signature text PRIMARY KEY,fixture_id text NOT NULL REFERENCES fanta.fixtures(id),
 captured_at timestamptz NOT NULL,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fanta.result_revisions(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,matchup_id text NOT NULL REFERENCES fanta.matchups(id),
 model_key text NOT NULL,input_hash text NOT NULL,previous_data jsonb,next_data jsonb NOT NULL,
 previous_official boolean,next_official boolean NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(matchup_id,model_key,input_hash)
);
