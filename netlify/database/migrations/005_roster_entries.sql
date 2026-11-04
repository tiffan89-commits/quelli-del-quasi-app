-- Source rosters retain every real purchase even when a provider ID is unavailable.
CREATE TABLE IF NOT EXISTS fanta.roster_entries(
 league_id text NOT NULL REFERENCES fanta.leagues(id),team_id text NOT NULL REFERENCES fanta.teams(id),
 source_id text NOT NULL,name text NOT NULL,role text NOT NULL CHECK(role IN('P','D','C','A')),
 price int NOT NULL CHECK(price>=0),player_id text REFERENCES fanta.players(id),data jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(team_id,source_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS roster_entries_provider ON fanta.roster_entries(league_id,player_id) WHERE player_id IS NOT NULL;
