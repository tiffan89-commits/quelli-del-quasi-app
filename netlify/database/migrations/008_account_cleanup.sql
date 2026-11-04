-- Owner-requested cleanup: exact usernames only, never nicknames or similar names.
DO $$
DECLARE body jsonb; ids text[]; mails text[]; n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(826501);
 SELECT payload INTO body FROM fanta_state WHERE id=1 FOR UPDATE;
 SELECT array_agg(u->>'id') INTO ids FROM jsonb_array_elements(coalesce(body->'users','[]')) u
 WHERE lower(u->>'username') IN('testuser','testuser1234') AND NOT coalesce((u->>'adminOnly')::boolean,false);
 n:=coalesce(cardinality(ids),0);
 IF n>0 THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(body->'leagues','[]')) l WHERE l->>'admin'=ANY(ids) OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(l->'members','[]')) m WHERE m->>'uid'=ANY(ids))) OR EXISTS(SELECT 1 FROM fanta.teams WHERE user_id=ANY(ids)) THEN
   RAISE EXCEPTION 'Account di prova con partecipazioni: necessaria pulizia dello storico prima della rimozione';
  END IF;
  SELECT array_agg(t->>'mailId') INTO mails FROM jsonb_array_elements(coalesce(body->'accountTokens','[]')) t WHERE t->>'uid'=ANY(ids);
  body:=body||jsonb_build_object(
   'users',(SELECT coalesce(jsonb_agg(u),'[]') FROM jsonb_array_elements(body->'users') u WHERE NOT(u->>'id'=ANY(ids))),
   'sessions',(SELECT coalesce(jsonb_agg(u),'[]') FROM jsonb_array_elements(coalesce(body->'sessions','[]')) u WHERE NOT(u->>'uid'=ANY(ids))),
   'accountTokens',(SELECT coalesce(jsonb_agg(u),'[]') FROM jsonb_array_elements(coalesce(body->'accountTokens','[]')) u WHERE NOT(u->>'uid'=ANY(ids))),
   'accountRequests','[]'::jsonb,
   'accessEvents',(SELECT coalesce(jsonb_agg(u),'[]') FROM jsonb_array_elements(coalesce(body->'accessEvents','[]')) u WHERE coalesce(u->>'uid','')<>ALL(ids)),
   'mailOutbox',(SELECT coalesce(jsonb_agg(u),'[]') FROM jsonb_array_elements(coalesce(body->'mailOutbox','[]')) u WHERE NOT(coalesce(u->>'id','')=ANY(coalesce(mails,ARRAY[]::text[]))))
  );
  UPDATE fanta_state SET payload=body WHERE id=1;
 END IF;
 INSERT INTO fanta.jobs(id,data) VALUES('maintenance:remove-test-accounts-20261101',jsonb_build_object('removed',n,'at',now())) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data;
END $$;
CREATE OR REPLACE FUNCTION fanta.lock_started_league_size() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.max_members<>OLD.max_members AND EXISTS(SELECT 1 FROM fanta.competitions c WHERE c.league_id=OLD.id AND c.status<>'draft') THEN RAISE EXCEPTION 'La taglia della lega è bloccata dopo l’avvio' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER league_size_after_start BEFORE UPDATE OF max_members ON fanta.leagues FOR EACH ROW EXECUTE FUNCTION fanta.lock_started_league_size();
