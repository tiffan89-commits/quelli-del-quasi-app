-- Owner-requested deactivation; retain native history and archive the removed Bar.
DO $$
DECLARE s jsonb; bar_id text:='08094400244a08070612e18a'; native_id text:='fanta-lucas-a'; receipt jsonb;
BEGIN
 SELECT payload INTO s FROM fanta_state WHERE id=1 FOR UPDATE;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(s->'leagues','[]')) l WHERE l->>'id'=bar_id AND lower(trim(l->>'name'))<>'lucas bar') THEN RAISE EXCEPTION 'Lucas Bar identity mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM fanta.leagues WHERE id=native_id AND source_key IS NOT NULL AND source_key<>'lucas-bar:548867') THEN RAISE EXCEPTION 'Lucas Fanta identity mismatch'; END IF;
 INSERT INTO fanta.cutover_archive(id,data) VALUES('disable-lucas-a-v1',jsonb_build_object(
  'leagues',(SELECT coalesce(jsonb_agg(l),'[]') FROM jsonb_array_elements(coalesce(s->'leagues','[]')) l WHERE l->>'id'=bar_id),
  'rounds',(SELECT coalesce(jsonb_agg(r),'[]') FROM jsonb_array_elements(coalesce(s->'rounds','[]')) r WHERE r->>'league'=bar_id),
  'ledger',(SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_array_elements(coalesce(s->'ledger','[]')) x WHERE x->>'league'=bar_id),
  'nativeLeague',(SELECT to_jsonb(l) FROM fanta.leagues l WHERE id=native_id),
  'auction',(SELECT to_jsonb(a) FROM fanta.auctions a WHERE league_id=native_id),
  'links',(SELECT coalesce(jsonb_agg(b),'[]') FROM fanta.bar_links b WHERE b.fanta_league_id=native_id OR b.bar_league_id=bar_id),
  'pendingNotifications',(SELECT coalesce(jsonb_agg(n),'[]') FROM fanta.notifications n WHERE n.data->>'league'=native_id AND n.delivered_at IS NULL)
 )) ON CONFLICT DO NOTHING;
 UPDATE fanta.leagues SET rules=rules||jsonb_build_object('disabledAt',now(),'disabledReason','owner-request'),auto_lineups_from=NULL,slips_enabled=false WHERE id=native_id;
 UPDATE fanta.bar_links SET active=false WHERE fanta_league_id=native_id OR bar_league_id=bar_id;
 UPDATE fanta.auctions SET version=version+1,data=data||jsonb_build_object('version',version+1,'status','ended','disabledAt',now(),'lot',NULL,'table',NULL,'caller',NULL,'callDeadline',NULL,'pausedUntil',NULL) WHERE league_id=native_id;
 UPDATE fanta.notifications SET expires_at=now() WHERE data->>'league'=native_id AND delivered_at IS NULL;
 s=jsonb_set(s,'{leagues}',(SELECT coalesce(jsonb_agg(l),'[]') FROM jsonb_array_elements(coalesce(s->'leagues','[]')) l WHERE l->>'id'<>bar_id));
 s=jsonb_set(s,'{rounds}',(SELECT coalesce(jsonb_agg(r),'[]') FROM jsonb_array_elements(coalesce(s->'rounds','[]')) r WHERE r->>'league' IS DISTINCT FROM bar_id));
 s=jsonb_set(s,'{ledger}',(SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_array_elements(coalesce(s->'ledger','[]')) x WHERE x->>'league' IS DISTINCT FROM bar_id));
 receipt=jsonb_build_object('barId',bar_id,'fantaId',native_id,'disabledAt',now(),'archived',true,'nativeDisabled',EXISTS(SELECT 1 FROM fanta.leagues WHERE id=native_id AND rules->>'disabledAt' IS NOT NULL),'nativeTeams',(SELECT count(*) FROM fanta.teams WHERE league_id=native_id),'nativeRosters',(SELECT count(*) FROM fanta.rosters WHERE league_id=native_id));
 UPDATE fanta_state SET payload=jsonb_set(s,'{lucasDeactivationReceipt}',receipt) WHERE id=1;
END $$;
