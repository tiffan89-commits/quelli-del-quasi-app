CREATE TABLE fanta.bar_football_round_cache (
  cache_key text PRIMARY KEY,
  data jsonb NOT NULL
);

INSERT INTO fanta.bar_football_round_cache (cache_key, data)
SELECT entry.key, entry.value
FROM fanta_state
CROSS JOIN LATERAL jsonb_each(NULLIF(payload #> '{football,rounds}', 'null'::jsonb)) AS entry
WHERE id = 1;
