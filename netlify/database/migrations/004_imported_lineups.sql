-- Preserve submitted formations independently of auction prices and provider IDs.
ALTER TABLE fanta.lineups ADD COLUMN IF NOT EXISTS source_data jsonb NOT NULL DEFAULT '{}';
WITH sheets AS (
 SELECT l.id AS league_id,(r->>'number')::int AS round,t.id AS team_id,sheet
 FROM fanta.import_sources s JOIN fanta.leagues l ON l.source_key=s.id
 CROSS JOIN LATERAL jsonb_array_elements(s.data->'rounds') r
 JOIN fanta.rounds known ON known.league_id=l.id AND known.number=(r->>'number')::int
 CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m
 CROSS JOIN LATERAL jsonb_array_elements(m#>'{details,teams}') sheet
 JOIN fanta.teams t ON t.league_id=l.id AND t.name=sheet->>'name'
 WHERE jsonb_array_length(coalesce(sheet->'players','[]'))>0
), normalized AS (
 SELECT sheets.*,p,ord,'lfc:'||md5(lower(p->>'name')||':'||coalesce(p->>'club','')||':'||(p->>'role')) AS pid
 FROM sheets CROSS JOIN LATERAL jsonb_array_elements(sheet->'players') WITH ORDINALITY q(p,ord)
), formed AS (
 SELECT league_id,round,team_id,sheet->>'formation' AS formation,
 jsonb_agg(to_jsonb(pid) ORDER BY ord) FILTER(WHERE (p->>'starter')::boolean) AS starters,
 coalesce(jsonb_agg(to_jsonb(pid) ORDER BY ord) FILTER(WHERE NOT (p->>'starter')::boolean),'[]') AS bench,
 jsonb_build_object('origin','leghe-import','players',jsonb_agg(p||jsonb_build_object('sourceId',p->>'id','id',pid) ORDER BY ord)) AS source_data
 FROM normalized GROUP BY league_id,round,team_id,sheet
 HAVING count(*) FILTER(WHERE (p->>'starter')::boolean)=11
 AND count(DISTINCT pid)=count(*) AND bool_and(p->>'role' IN ('P','D','C','A'))
 AND count(*) FILTER(WHERE (p->>'starter')::boolean AND p->>'role'='P')=1
 AND sheet->>'formation' IN ('3-4-3','3-5-2','4-3-3','4-4-2','4-5-1','5-3-2','5-4-1')
 AND count(*) FILTER(WHERE (p->>'starter')::boolean AND p->>'role'='D')=split_part(sheet->>'formation','-',1)::int
 AND count(*) FILTER(WHERE (p->>'starter')::boolean AND p->>'role'='C')=split_part(sheet->>'formation','-',2)::int
 AND count(*) FILTER(WHERE (p->>'starter')::boolean AND p->>'role'='A')=split_part(sheet->>'formation','-',3)::int
)
INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,source_data)
SELECT league_id,round,team_id,formation,starters,bench,source_data FROM formed
ON CONFLICT(league_id,round,team_id) DO UPDATE SET
 formation=EXCLUDED.formation,starters=EXCLUDED.starters,bench=EXCLUDED.bench,source_data=EXCLUDED.source_data
WHERE fanta.lineups.source_data->>'origin'='leghe-import'
 AND fanta.lineups.source_data IS DISTINCT FROM EXCLUDED.source_data;
