ALTER TABLE public.fanta_state ADD CONSTRAINT bar_root_excludes_normalized_data
CHECK (storage_shape IS NULL OR payload=fanta.bar_document_root(payload));

CREATE VIEW fanta.bar_membership_document AS
SELECT id,payload||jsonb_build_object('leagues',COALESCE(
  (SELECT jsonb_agg(data ORDER BY position) FROM fanta.bar_league_state),'[]')) AS payload,
  xmin::text AS storage_revision
FROM public.fanta_state WHERE storage_shape IS NOT NULL;

CREATE FUNCTION fanta.bar_update_membership_document()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_revision text;
BEGIN
  IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Cannot change the Bar state identity'; END IF;
  IF NOT pg_try_advisory_xact_lock(826501) THEN
    RAISE EXCEPTION 'Bar state changed concurrently' USING ERRCODE='40001';
  END IF;
  SELECT xmin::text INTO current_revision FROM public.fanta_state WHERE id=OLD.id FOR UPDATE;
  IF current_revision IS DISTINCT FROM OLD.storage_revision THEN
    RAISE EXCEPTION 'Bar state changed concurrently' USING ERRCODE='40001';
  END IF;
  IF OLD.payload->'leagues' IS DISTINCT FROM NEW.payload->'leagues' THEN
    PERFORM fanta.bar_replace_ordered('fanta.bar_league_state',NEW.payload->'leagues');
  END IF;
  UPDATE public.fanta_state SET payload=NEW.payload-'leagues' WHERE id=OLD.id;
  RETURN NEW;
END
$$;

CREATE TRIGGER bar_update_membership_document INSTEAD OF UPDATE ON fanta.bar_membership_document
FOR EACH ROW EXECUTE FUNCTION fanta.bar_update_membership_document();
