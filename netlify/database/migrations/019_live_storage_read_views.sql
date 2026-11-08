CREATE VIEW fanta.bar_matchday_documents AS
SELECT r.id, r.league_id, r.position,
  r.data
  || CASE WHEN r.has_matches THEN jsonb_build_object('matches', COALESCE(
    (SELECT jsonb_agg(m.data ORDER BY m.position) FROM fanta.bar_matchday_matches m WHERE m.matchday_id = r.id),
    '[]'::jsonb)) ELSE '{}'::jsonb END
  || CASE WHEN r.has_slips THEN jsonb_build_object('slips', COALESCE(
    (SELECT jsonb_agg(s.data ORDER BY s.position) FROM fanta.bar_slips s WHERE s.matchday_id = r.id),
    '[]'::jsonb)) ELSE '{}'::jsonb END AS data
FROM fanta.bar_matchdays r;

CREATE VIEW fanta.bar_seriea_calendar_documents AS
SELECT r.position, r.data || jsonb_build_object('matches', COALESCE(
  (SELECT jsonb_agg(m.data ORDER BY m.position) FROM fanta.bar_seriea_matches m WHERE m.round_position = r.position),
  '[]'::jsonb)) AS data
FROM fanta.bar_seriea_calendar_rounds r;
