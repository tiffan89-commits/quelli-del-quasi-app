-- Recovery procedure only. NOT an automatic migration.
-- Stop background writers and approve the matching application rollback first.
-- Keep new pilot leagues, rosters, votes, users and permanent identities.
BEGIN;
SELECT pg_advisory_xact_lock(826501);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM fanta.cutover_archive WHERE id='native-cutover-v1') THEN RAISE EXCEPTION 'Archivio di ripristino non disponibile'; END IF;
 IF EXISTS(SELECT 1 FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'rounds') r WHERE r?'nativeFanta' AND jsonb_array_length(coalesce(r->'slips','[]'))>0) THEN RAISE EXCEPTION 'Esistono schedine native: serve un ripristino con riconciliazione, senza sovrascrivere saldi e storico'; END IF;
END $$;
UPDATE fanta_state s SET payload=jsonb_set(jsonb_set(s.payload||jsonb_build_object('fantasyConnections',a.data->'connections','fantasyAttempts',a.data->'attempts'),'{leagues}',(SELECT coalesce(jsonb_agg(l-ARRAY['nativeFantaLink','nativeFantaTeams']::text[]),'[]') FROM jsonb_array_elements(s.payload->'leagues') l)),'{rounds}',(SELECT coalesce(jsonb_agg(CASE WHEN r?'nativeFanta' THEN coalesce((SELECT old FROM jsonb_array_elements(a.data->'rounds') old WHERE old->>'id'=r->>'id'),(r-'nativeFanta')||jsonb_build_object('sourceConflict',true,'archived',true)) ELSE r END),'[]') FROM jsonb_array_elements(s.payload->'rounds') r)) FROM fanta.cutover_archive a WHERE s.id=1 AND a.id='native-cutover-v1';
UPDATE fanta.bar_links SET active=false;
UPDATE fanta.leagues SET auto_lineups_from=NULL WHERE source_key='lucas-bar:548867';
UPDATE fanta.cutover_archive SET restored_at=now() WHERE id='native-cutover-v1';
COMMIT;
