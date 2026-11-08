ALTER TABLE fanta.bar_league_state ADD COLUMN position integer;

WITH old_order AS (
  SELECT old.data ->> 'id' AS id, old.position
  FROM fanta_state
  CROSS JOIN LATERAL jsonb_array_elements(payload -> 'leagues')
    WITH ORDINALITY old(data, position)
  WHERE fanta_state.id = 1
), ordered AS (
  SELECT league.id, row_number() OVER (ORDER BY old.position NULLS LAST, league.id) AS position
  FROM fanta.bar_league_state league
  LEFT JOIN old_order old USING (id)
)
UPDATE fanta.bar_league_state league SET position = ordered.position
FROM ordered WHERE league.id = ordered.id;

ALTER TABLE fanta.bar_league_state
  ALTER COLUMN position SET NOT NULL,
  ADD CONSTRAINT bar_league_state_position_key UNIQUE (position);
