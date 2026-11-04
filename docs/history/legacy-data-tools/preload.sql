-- Run against the remote DB only, after migration 003, inside a transaction.
-- No source rows are returned or written to the Bar. No credentials are copied.
DO $$
DECLARE matches integer;
BEGIN
 SELECT count(*) INTO matches FROM fanta_state s
 CROSS JOIN LATERAL jsonb_array_elements(s.payload->'fantasyConnections') c
 WHERE c->>'alias'='lucas-bar' AND c->>'competitionId'='548867'
 AND c->>'owner' IN(SELECT u->>'id' FROM fanta_state z CROSS JOIN LATERAL jsonb_array_elements(z.payload->'users') u WHERE lower(u->>'username')='frankwood');
 IF matches<>1 THEN RAISE EXCEPTION 'Collegamento beta non identificato in modo univoco'; END IF;
END $$;
WITH source AS (
 SELECT c->>'owner' AS uid,jsonb_build_object(
  'alias',c->>'alias','competitionId',548867,'season',c->'season',
  'competitionName',c->>'competitionName','teamIdentities',c->'teamIdentities',
  'rounds',c->'rounds') AS data
 FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'fantasyConnections') c
 WHERE c->>'alias'='lucas-bar' AND c->>'competitionId'='548867'
 AND c->>'owner' IN(SELECT u->>'id' FROM fanta_state z CROSS JOIN LATERAL jsonb_array_elements(z.payload->'users') u WHERE lower(u->>'username')='frankwood')
)
INSERT INTO fanta.import_sources(id,owner_uid,data,digest)
SELECT 'lucas-bar:548867',uid,data,md5(data::text) FROM source
ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,digest=EXCLUDED.digest,captured_at=now()
WHERE fanta.import_sources.digest<>EXCLUDED.digest;
