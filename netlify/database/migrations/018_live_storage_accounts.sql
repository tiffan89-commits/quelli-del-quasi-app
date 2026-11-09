CREATE TABLE fanta.bar_league_state (
  id text PRIMARY KEY CHECK (id <> ''),
  data jsonb NOT NULL
);

CREATE TABLE fanta.bar_analysis_hashes (
  hash text PRIMARY KEY CHECK (hash <> ''),
  data jsonb NOT NULL
);

INSERT INTO fanta.bar_league_state (id, data)
SELECT league ->> 'id', league
FROM fanta_state
CROSS JOIN LATERAL jsonb_array_elements(NULLIF(payload -> 'leagues', 'null'::jsonb)) AS leagues(league)
WHERE id = 1;

INSERT INTO fanta.bar_analysis_hashes (hash, data)
SELECT hashes.key, hashes.value
FROM fanta_state
CROSS JOIN LATERAL jsonb_each(NULLIF(payload -> 'analysisTextHashes', 'null'::jsonb)) AS hashes
WHERE id = 1;
