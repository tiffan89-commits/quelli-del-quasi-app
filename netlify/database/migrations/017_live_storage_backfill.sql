-- Add the row-based storage alongside the current snapshot. The application
-- switches its readers and writers in a later step, after comparing both shapes.
CREATE TABLE fanta.bar_seriea_calendar_rounds (
  position integer PRIMARY KEY CHECK (position > 0),
  data jsonb NOT NULL
);

CREATE TABLE fanta.bar_seriea_matches (
  id text PRIMARY KEY CHECK (id <> ''),
  round_position integer NOT NULL REFERENCES fanta.bar_seriea_calendar_rounds(position),
  position integer NOT NULL CHECK (position > 0),
  data jsonb NOT NULL,
  UNIQUE (round_position, position)
);

CREATE TABLE fanta.bar_matchdays (
  id text PRIMARY KEY CHECK (id <> ''),
  league_id text NOT NULL,
  position integer NOT NULL UNIQUE CHECK (position > 0),
  has_matches boolean NOT NULL,
  has_slips boolean NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX bar_matchdays_by_league ON fanta.bar_matchdays (league_id, position);

CREATE TABLE fanta.bar_matchday_matches (
  matchday_id text NOT NULL REFERENCES fanta.bar_matchdays(id) ON DELETE CASCADE,
  id text NOT NULL CHECK (id <> ''),
  position integer NOT NULL CHECK (position > 0),
  data jsonb NOT NULL,
  PRIMARY KEY (matchday_id, id),
  UNIQUE (matchday_id, position)
);
CREATE INDEX bar_matchday_matches_by_match ON fanta.bar_matchday_matches (id);

CREATE TABLE fanta.bar_slips (
  matchday_id text NOT NULL REFERENCES fanta.bar_matchdays(id) ON DELETE CASCADE,
  user_id text NOT NULL CHECK (user_id <> ''),
  position integer NOT NULL CHECK (position > 0),
  data jsonb NOT NULL,
  PRIMARY KEY (matchday_id, user_id),
  UNIQUE (matchday_id, position)
);

CREATE TABLE fanta.bar_player_rewards (
  user_id text PRIMARY KEY CHECK (user_id <> ''),
  data jsonb NOT NULL
);

CREATE TABLE fanta.bar_player_profiles (
  profile_key text PRIMARY KEY CHECK (profile_key <> ''),
  data jsonb NOT NULL
);

CREATE TABLE fanta.bar_credit_ledger (
  id text PRIMARY KEY CHECK (id <> ''),
  position integer NOT NULL UNIQUE CHECK (position > 0),
  data jsonb NOT NULL
);

INSERT INTO fanta.bar_seriea_calendar_rounds (position, data)
SELECT round_position, round - 'matches'
FROM fanta_state
CROSS JOIN LATERAL jsonb_array_elements(payload #> '{football,calendar,rounds}')
  WITH ORDINALITY AS calendar(round, round_position)
WHERE id = 1;

INSERT INTO fanta.bar_seriea_matches (id, round_position, position, data)
SELECT match ->> 'id', round_position, match_position, match
FROM fanta_state
CROSS JOIN LATERAL jsonb_array_elements(payload #> '{football,calendar,rounds}')
  WITH ORDINALITY AS calendar(round, round_position)
CROSS JOIN LATERAL jsonb_array_elements(round -> 'matches')
  WITH ORDINALITY AS fixtures(match, match_position)
WHERE id = 1;

INSERT INTO fanta.bar_matchdays (id, league_id, position, has_matches, has_slips, data)
SELECT day ->> 'id', day ->> 'league', day_position,
  COALESCE(jsonb_typeof(day -> 'matches') = 'array', false),
  COALESCE(jsonb_typeof(day -> 'slips') = 'array', false),
  (CASE WHEN jsonb_typeof(day -> 'matches') = 'array' THEN day - 'matches' ELSE day END)
    - CASE WHEN jsonb_typeof(day -> 'slips') = 'array' THEN ARRAY['slips'] ELSE ARRAY[]::text[] END
FROM fanta_state
CROSS JOIN LATERAL jsonb_array_elements(payload -> 'rounds')
  WITH ORDINALITY AS matchdays(day, day_position)
WHERE id = 1;

INSERT INTO fanta.bar_matchday_matches (matchday_id, id, position, data)
SELECT day ->> 'id', match ->> 'id', match_position, match
FROM fanta_state
CROSS JOIN LATERAL jsonb_array_elements(payload -> 'rounds') AS matchdays(day)
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(day -> 'matches') = 'array' THEN day -> 'matches' ELSE '[]'::jsonb END
) WITH ORDINALITY AS matches(match, match_position)
WHERE id = 1;

INSERT INTO fanta.bar_slips (matchday_id, user_id, position, data)
SELECT day ->> 'id', slip ->> 'uid', slip_position, slip
FROM fanta_state
CROSS JOIN LATERAL jsonb_array_elements(payload -> 'rounds') AS matchdays(day)
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(day -> 'slips') = 'array' THEN day -> 'slips' ELSE '[]'::jsonb END
) WITH ORDINALITY AS slips(slip, slip_position)
WHERE id = 1;

INSERT INTO fanta.bar_player_rewards (user_id, data)
SELECT rewards.key, rewards.value
FROM fanta_state
CROSS JOIN LATERAL jsonb_each(NULLIF(payload -> 'playerRewards', 'null'::jsonb)) AS rewards
WHERE id = 1;

INSERT INTO fanta.bar_player_profiles (profile_key, data)
SELECT profiles.key, profiles.value
FROM fanta_state
CROSS JOIN LATERAL jsonb_each(NULLIF(payload -> 'playerProfiles', 'null'::jsonb)) AS profiles
WHERE id = 1;

INSERT INTO fanta.bar_credit_ledger (id, position, data)
SELECT entry ->> 'id', entry_position, entry
FROM fanta_state
CROSS JOIN LATERAL jsonb_array_elements(payload -> 'ledger')
  WITH ORDINALITY AS ledger(entry, entry_position)
WHERE id = 1;
