-- Move the existing championship, never recreate teams, rounds or rosters.
DO $$
DECLARE s jsonb; src jsonb; dst jsonb; members jsonb; sm jsonb; dm jsonb; k text; testids text[]; coaches jsonb;
 target text := '6696ed2e771c593d37c402ef'; origin text := 'bar:pilot:2026:1'; native text := 'pilot:2026:1';
BEGIN
 SELECT payload INTO s FROM fanta_state WHERE id=1 FOR UPDATE;
 SELECT l INTO src FROM jsonb_array_elements(s->'leagues') l WHERE l->>'id'=origin;
 SELECT l INTO dst FROM jsonb_array_elements(s->'leagues') l WHERE l->>'id'=target;
 IF src IS NULL THEN RETURN; END IF;
 IF dst IS NULL OR NOT EXISTS(SELECT 1 FROM fanta.leagues WHERE id=native) THEN RAISE EXCEPTION 'Expected destination Bar or existing championship missing'; END IF;
 IF EXISTS(SELECT 1 FROM fanta.bar_links WHERE bar_league_id=target AND active AND fanta_league_id<>native) THEN RAISE EXCEPTION 'Destination already linked to another championship'; END IF;
 INSERT INTO fanta.cutover_archive(id,data) VALUES('merge-quelli-v1',jsonb_build_object('leagues',jsonb_build_array(dst,src),'rounds',(SELECT coalesce(jsonb_agg(r),'[]') FROM jsonb_array_elements(s->'rounds') r WHERE r->>'league' IN(target,origin)),'ledger',(SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_array_elements(coalesce(s->'ledger','[]')) x WHERE x->>'league' IN(target,origin)),'teams',(SELECT jsonb_agg(to_jsonb(t)) FROM fanta.teams t WHERE league_id=native))) ON CONFLICT DO NOTHING;
 SELECT coalesce(array_agg(u->>'id'),ARRAY[]::text[]) INTO testids FROM jsonb_array_elements(s->'users') u WHERE lower(u->>'username') IN('testuser','testuser2');
 UPDATE fanta.teams SET user_id=NULL,manager=coalesce(coach_name,'Panchina disponibile') WHERE league_id=native AND user_id=ANY(testids);
 DELETE FROM fanta.pilot_claims WHERE league_id=native AND user_id=ANY(testids);
 SELECT coalesce(jsonb_agg(user_id ORDER BY user_id),'[]') INTO coaches FROM fanta.teams WHERE league_id=native AND user_id IS NOT NULL;
 members:=coalesce(dst->'members','[]');
 FOR sm IN SELECT x FROM jsonb_array_elements(coalesce(src->'members','[]')) x LOOP
  SELECT x INTO dm FROM jsonb_array_elements(members) x WHERE x->>'uid'=sm->>'uid';
  IF dm IS NULL THEN
   IF NOT (sm->>'uid'=ANY(testids)) THEN members:=members||jsonb_build_array(sm); END IF;
  ELSE
   FOR k IN SELECT unnest(ARRAY['fantasyWallets','fantasyBalances','competitionPoints']) LOOP
    IF EXISTS(SELECT 1 FROM jsonb_each(coalesce(sm->k,'{}')) a JOIN jsonb_each(coalesce(dm->k,'{}')) b ON a.key=b.key WHERE a.value<>b.value) THEN RAISE EXCEPTION 'Wallet conflict for member %, key %',sm->>'uid',k; END IF;
   END LOOP;
   dm:=sm||dm||jsonb_build_object('fantasyWallets',coalesce(sm->'fantasyWallets','{}')||coalesce(dm->'fantasyWallets','{}'),'fantasyBalances',coalesce(sm->'fantasyBalances','{}')||coalesce(dm->'fantasyBalances','{}'),'competitionPoints',coalesce(sm->'competitionPoints','{}')||coalesce(dm->'competitionPoints','{}'));
   SELECT jsonb_agg(CASE WHEN x->>'uid'=sm->>'uid' THEN dm ELSE x END) INTO members FROM jsonb_array_elements(members) x;
  END IF;
 END LOOP;
 dst:=src||dst||jsonb_build_object('name','Quelli del quasi','members',members,'demo',false,'nativeMigration',jsonb_build_object('version',1,'fromBar',origin,'teams',(SELECT count(*) FROM fanta.teams WHERE league_id=native),'rosterEntries',(SELECT count(*) FROM fanta.rosters WHERE league_id=native),'lineups',(SELECT count(*) FROM fanta.lineups WHERE league_id=native),'availableTeams',(SELECT count(*) FROM fanta.teams WHERE league_id=native AND user_id IS NULL)),'nativeFantaLink',jsonb_build_object('leagueId',native,'competitionId',native||':main','coachIds',coaches),'fantaSlipsEnabled',coalesce(src->'fantaSlipsEnabled','true'::jsonb),'fantasyWalletScopes',coalesce(src->'fantasyWalletScopes','{}')||coalesce(dst->'fantasyWalletScopes','{}'),'fantasyTeams',coalesce(src->'fantasyTeams','{}')||coalesce(dst->'fantasyTeams','{}'),'nativeFantaTeams',coalesce(src->'nativeFantaTeams','{}')||coalesce(dst->'nativeFantaTeams','{}'));
 s:=jsonb_set(s,'{leagues}',(SELECT jsonb_agg(CASE WHEN l->>'id'=target THEN dst ELSE l END) FROM jsonb_array_elements(s->'leagues') l WHERE l->>'id'<>origin));
 s:=jsonb_set(s,'{rounds}',(SELECT coalesce(jsonb_agg(CASE WHEN r->>'league'=origin THEN r||jsonb_build_object('league',target,'competitionName','Quelli del quasi','fantasyLeagueName','Quelli del quasi') ELSE r END),'[]') FROM jsonb_array_elements(s->'rounds') r));
 s:=jsonb_set(s,'{ledger}',(SELECT coalesce(jsonb_agg(CASE WHEN x->>'league'=origin THEN x||jsonb_build_object('league',target) ELSE x END),'[]') FROM jsonb_array_elements(coalesce(s->'ledger','[]')) x));
 UPDATE fanta.leagues SET name='Quelli del quasi',kind='random',admin_uid=dst->>'admin' WHERE id=native;
 UPDATE fanta.competitions SET name='Quelli del quasi' WHERE id=native||':main';
 DELETE FROM fanta.bar_links WHERE bar_league_id=target AND NOT active;
 UPDATE fanta.bar_links SET bar_league_id=target,active=true WHERE bar_league_id=origin AND fanta_league_id=native;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original championship Bar link missing'; END IF;
 UPDATE fanta.bar_assets SET league_id=target WHERE league_id=origin;
 INSERT INTO fanta.creation_jobs(id,bar_id,owner_uid,size,name,status,league_id) SELECT 'linked:'||native,target,dst->>'admin',count(*)::int,'Quelli del quasi','ready',native FROM fanta.teams WHERE league_id=native ON CONFLICT(bar_id) DO UPDATE SET name='Quelli del quasi',league_id=EXCLUDED.league_id,status='ready';
 UPDATE fanta_state SET payload=s||jsonb_build_object('fantaAccessPolicy','linked-bars-only-v2') WHERE id=1;
END $$;
