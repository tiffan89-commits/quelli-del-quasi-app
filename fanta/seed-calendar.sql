-- Run only against the remote native schema after the authorized archive import.
-- Unknown kickoff times remain in the source archive; deadlines are never invented.
-- This creates the real calendar and owner association, without inventing roster prices.
INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules,source_key)
SELECT 'fanta-lucas-a','Fanta Lucas Bar Lega A',2026,owner_uid,'FANTA-'||upper(substr(md5(owner_uid||':lucas-a'),1,10)),
 $1::jsonb||jsonb_build_object('_migrationStage','calendar'),'lucas-bar:548867'
FROM fanta.import_sources WHERE id='lucas-bar:548867'
ON CONFLICT(id) DO NOTHING;

WITH source AS(SELECT data,owner_uid FROM fanta.import_sources WHERE id='lucas-bar:548867'), names AS(
 SELECT DISTINCT name FROM source CROSS JOIN LATERAL jsonb_array_elements(data->'rounds') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m CROSS JOIN LATERAL(VALUES(m->>'home'),(m->>'away')) n(name)
)
INSERT INTO fanta.teams(id,league_id,user_id,name,manager)
SELECT 'fanta-lucas-a:'||md5(lower(name)),'fanta-lucas-a',CASE WHEN lower(regexp_replace(name,'[^[:alnum:]]','','g'))='flyemigrates' THEN owner_uid ELSE NULL END,name,''
FROM names CROSS JOIN source ON CONFLICT(id) DO NOTHING;

WITH resolved AS (
 SELECT (r->>'number')::int AS number,(r->>'serieARound')::int AS seriea_round,
 coalesce((r->>'deadline')::timestamptz,(r->>'kickoff')::timestamptz,
 (SELECT min((m->>'kickoff')::timestamptz) FROM fanta_state z
 CROSS JOIN LATERAL jsonb_array_elements(z.payload#>'{football,calendar,rounds}') a
 CROSS JOIN LATERAL jsonb_array_elements(a->'matches') m
 WHERE z.id=1 AND a->>'number'=r->>'serieARound')) AS deadline,
 coalesce((r->>'calculated')::boolean,false) AS official
 FROM fanta.import_sources s CROSS JOIN LATERAL jsonb_array_elements(s.data->'rounds') r
 WHERE s.id='lucas-bar:548867'
)
INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline,official)
SELECT 'fanta-lucas-a',number,seriea_round,deadline,official FROM resolved WHERE deadline IS NOT NULL
ON CONFLICT(competition_id,number) DO NOTHING;

INSERT INTO fanta.matchups(id,league_id,round,home_id,away_id)
SELECT 'fanta-lucas-a:'||(r->>'number')||':'||(ord-1),'fanta-lucas-a',(r->>'number')::int,h.id,a.id
FROM fanta.import_sources s CROSS JOIN LATERAL jsonb_array_elements(s.data->'rounds') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') WITH ORDINALITY x(m,ord)
JOIN fanta.rounds known ON known.league_id='fanta-lucas-a' AND known.number=(r->>'number')::int AND known.competition_id='fanta-lucas-a:main'
JOIN fanta.teams h ON h.league_id='fanta-lucas-a' AND h.name=m->>'home' JOIN fanta.teams a ON a.league_id='fanta-lucas-a' AND a.name=m->>'away' WHERE s.id='lucas-bar:548867'
ON CONFLICT(id) DO NOTHING;

INSERT INTO fanta.reference_results(matchup_id,data,digest)
SELECT z.id,z.data,md5(z.data::text) FROM (
 SELECT 'fanta-lucas-a:'||(r->>'number')||':'||(ord-1) AS id,jsonb_build_object('home',jsonb_build_object('points',m->'fantasyPoints'->0,'goals',m->'score'->0),'away',jsonb_build_object('points',m->'fantasyPoints'->1,'goals',m->'score'->1)) AS data
 FROM fanta.import_sources s CROSS JOIN LATERAL jsonb_array_elements(s.data->'rounds') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') WITH ORDINALITY x(m,ord)
 WHERE s.id='lucas-bar:548867' AND r->>'calculated'='true' AND jsonb_typeof(m->'fantasyPoints'->0)='number' AND jsonb_typeof(m->'fantasyPoints'->1)='number' AND jsonb_typeof(m->'score'->0)='number' AND jsonb_typeof(m->'score'->1)='number'
) z ON CONFLICT(matchup_id) DO NOTHING;

INSERT INTO fanta.results(matchup_id,historical,official,data)
SELECT m.id,true,true,jsonb_build_object('id',m.id,'home',r.data->'home'||jsonb_build_object('team',jsonb_build_object('id',h.id,'name',h.name,'manager',h.manager,'color',h.color)),'away',r.data->'away'||jsonb_build_object('team',jsonb_build_object('id',a.id,'name',a.name,'manager',a.manager,'color',a.color)))
FROM fanta.reference_results r JOIN fanta.matchups m ON m.id=r.matchup_id JOIN fanta.teams h ON h.id=m.home_id JOIN fanta.teams a ON a.id=m.away_id WHERE m.league_id='fanta-lucas-a'
ON CONFLICT(matchup_id) DO NOTHING;

UPDATE fanta.leagues SET max_members=10 WHERE id='fanta-lucas-a' AND max_members<>10 AND (SELECT count(*) FROM fanta.teams WHERE league_id='fanta-lucas-a')=10;
UPDATE fanta.competitions SET status='active',start_round=(SELECT min(seriea_round) FROM fanta.rounds WHERE competition_id='fanta-lucas-a:main') WHERE id='fanta-lucas-a:main' AND status='draft' AND EXISTS(SELECT 1 FROM fanta.rounds WHERE competition_id='fanta-lucas-a:main' AND official);
