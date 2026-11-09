ALTER TABLE public.fanta_state ADD COLUMN storage_shape jsonb;

CREATE FUNCTION fanta.bar_section_shape(value jsonb, empty_value jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE WHEN jsonb_typeof(value) = jsonb_typeof(empty_value) THEN empty_value ELSE value END
$$;

CREATE FUNCTION fanta.bar_document_shape(document jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT COALESCE(jsonb_object_agg(key, value), '{}')
  FROM (VALUES
    ('leagues', fanta.bar_section_shape(document->'leagues', '[]')),
    ('rounds', fanta.bar_section_shape(document->'rounds', '[]')),
    ('ledger', fanta.bar_section_shape(document->'ledger', '[]')),
    ('playerRewards', fanta.bar_section_shape(document->'playerRewards', '{}')),
    ('playerProfiles', fanta.bar_section_shape(document->'playerProfiles', '{}')),
    ('analysisTextHashes', fanta.bar_section_shape(document->'analysisTextHashes', '{}')),
    ('calendar', fanta.bar_section_shape(document#>'{football,calendar,rounds}', '[]')),
    ('bookable', fanta.bar_section_shape(document#>'{football,rounds}', '{}'))
  ) fields(key,value) WHERE value IS NOT NULL
$$;

CREATE FUNCTION fanta.bar_document_root(document jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT (document - ARRAY['leagues','rounds','ledger','playerRewards','playerProfiles','analysisTextHashes'])
    #- '{football,calendar,rounds}' #- '{football,rounds}'
$$;

CREATE FUNCTION fanta.bar_restore_document(root jsonb, shape jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  document jsonb;
  part jsonb;
BEGIN
  IF shape IS NULL THEN RETURN root; END IF;
  SELECT root || COALESCE(jsonb_object_agg(key, value), '{}') INTO document
  FROM (VALUES
    ('leagues', COALESCE((SELECT jsonb_agg(data ORDER BY position) FROM fanta.bar_league_state), shape->'leagues')),
    ('rounds', COALESCE((SELECT jsonb_agg(data ORDER BY position) FROM fanta.bar_matchday_documents), shape->'rounds')),
    ('ledger', COALESCE((SELECT jsonb_agg(data ORDER BY position) FROM fanta.bar_credit_ledger), shape->'ledger')),
    ('playerRewards', COALESCE((SELECT jsonb_object_agg(user_id,data) FROM fanta.bar_player_rewards), shape->'playerRewards')),
    ('playerProfiles', COALESCE((SELECT jsonb_object_agg(profile_key,data) FROM fanta.bar_player_profiles), shape->'playerProfiles')),
    ('analysisTextHashes', COALESCE((SELECT jsonb_object_agg(hash,data) FROM fanta.bar_analysis_hashes), shape->'analysisTextHashes'))
  ) fields(key,value) WHERE value IS NOT NULL;

  SELECT COALESCE(jsonb_agg(data ORDER BY position), shape->'calendar') INTO part FROM fanta.bar_seriea_calendar_documents;
  IF part IS NOT NULL THEN document := jsonb_set(document,'{football,calendar,rounds}',part); END IF;
  SELECT COALESCE(jsonb_object_agg(cache_key,data), shape->'bookable') INTO part FROM fanta.bar_football_round_cache;
  IF part IS NOT NULL THEN document := jsonb_set(document,'{football,rounds}',part); END IF;
  RETURN document;
END
$$;

CREATE FUNCTION fanta.bar_replace_map(target regclass, key_column text, items jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'object' THEN items := '{}'; END IF;
  EXECUTE format('DELETE FROM %s WHERE NOT ($1 ? %I)', target, key_column) USING items;
  EXECUTE format('INSERT INTO %1$s AS current (%2$I,data)
    SELECT key,value FROM jsonb_each($1) ON CONFLICT (%2$I) DO UPDATE SET data=excluded.data
    WHERE current.data IS DISTINCT FROM excluded.data', target, key_column) USING items;
END
$$;

CREATE FUNCTION fanta.bar_replace_ordered(target regclass, items jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN items := '[]'; END IF;
  EXECUTE format('DELETE FROM %s current WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements($1) WITH ORDINALITY next(data,position)
    WHERE next.data->>''id''=current.id AND next.position=current.position)', target) USING items;
  EXECUTE format('INSERT INTO %1$s AS current (id,position,data)
    SELECT data->>''id'',position,data FROM jsonb_array_elements($1) WITH ORDINALITY next(data,position)
    ON CONFLICT (id) DO UPDATE SET data=excluded.data WHERE current.data IS DISTINCT FROM excluded.data', target) USING items;
END
$$;

CREATE FUNCTION fanta.bar_replace_matchdays(items jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  day record;
  has_matches boolean;
  has_slips boolean;
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN items := '[]'; END IF;
  DELETE FROM fanta.bar_matchdays current WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(items) WITH ORDINALITY next(data,position)
    WHERE next.data->>'id'=current.id AND next.position=current.position
  );
  FOR day IN
    SELECT next.data, next.position, next.data->>'id' AS id
    FROM jsonb_array_elements(items) WITH ORDINALITY next(data,position)
    LEFT JOIN fanta.bar_matchday_documents current ON current.id=next.data->>'id'
    WHERE current.data IS DISTINCT FROM next.data
  LOOP
    has_matches := COALESCE(jsonb_typeof(day.data->'matches')='array',false);
    has_slips := COALESCE(jsonb_typeof(day.data->'slips')='array',false);
    INSERT INTO fanta.bar_matchdays(id,league_id,position,has_matches,has_slips,data)
    VALUES(day.id,day.data->>'league',day.position,has_matches,has_slips,
      day.data - ARRAY(SELECT key FROM (VALUES ('matches',has_matches),('slips',has_slips)) fields(key,present) WHERE present))
    ON CONFLICT (id) DO UPDATE SET league_id=excluded.league_id,has_matches=excluded.has_matches,
      has_slips=excluded.has_slips,data=excluded.data;
    DELETE FROM fanta.bar_matchday_matches WHERE matchday_id=day.id;
    IF has_matches THEN
      INSERT INTO fanta.bar_matchday_matches(matchday_id,id,position,data)
      SELECT day.id,data->>'id',position,data FROM jsonb_array_elements(day.data->'matches') WITH ORDINALITY item(data,position);
    END IF;
    DELETE FROM fanta.bar_slips WHERE matchday_id=day.id;
    IF has_slips THEN
      INSERT INTO fanta.bar_slips(matchday_id,user_id,position,data)
      SELECT day.id,data->>'uid',position,data FROM jsonb_array_elements(day.data->'slips') WITH ORDINALITY item(data,position);
    END IF;
  END LOOP;
END
$$;

CREATE FUNCTION fanta.bar_replace_calendar(items jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN items := '[]'; END IF;
  DELETE FROM fanta.bar_seriea_matches;
  DELETE FROM fanta.bar_seriea_calendar_rounds;
  INSERT INTO fanta.bar_seriea_calendar_rounds(position,data)
  SELECT position,data-'matches' FROM jsonb_array_elements(items) WITH ORDINALITY day(data,position);
  INSERT INTO fanta.bar_seriea_matches(id,round_position,position,data)
  SELECT match.data->>'id',day.position,match.position,match.data
  FROM jsonb_array_elements(items) WITH ORDINALITY day(data,position)
  CROSS JOIN LATERAL jsonb_array_elements(day.data->'matches') WITH ORDINALITY match(data,position);
END
$$;

CREATE FUNCTION fanta.bar_write_document(previous jsonb, document jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF previous IS NULL OR previous->'leagues' IS DISTINCT FROM document->'leagues' THEN
    PERFORM fanta.bar_replace_ordered('fanta.bar_league_state',document->'leagues');
  END IF;
  IF previous IS NULL OR previous->'rounds' IS DISTINCT FROM document->'rounds' THEN
    PERFORM fanta.bar_replace_matchdays(document->'rounds');
  END IF;
  IF previous IS NULL OR previous->'ledger' IS DISTINCT FROM document->'ledger' THEN
    PERFORM fanta.bar_replace_ordered('fanta.bar_credit_ledger',document->'ledger');
  END IF;
  IF previous IS NULL OR previous->'playerRewards' IS DISTINCT FROM document->'playerRewards' THEN
    PERFORM fanta.bar_replace_map('fanta.bar_player_rewards','user_id',document->'playerRewards');
  END IF;
  IF previous IS NULL OR previous->'playerProfiles' IS DISTINCT FROM document->'playerProfiles' THEN
    PERFORM fanta.bar_replace_map('fanta.bar_player_profiles','profile_key',document->'playerProfiles');
  END IF;
  IF previous IS NULL OR previous->'analysisTextHashes' IS DISTINCT FROM document->'analysisTextHashes' THEN
    PERFORM fanta.bar_replace_map('fanta.bar_analysis_hashes','hash',document->'analysisTextHashes');
  END IF;
  IF previous IS NULL OR previous#>'{football,rounds}' IS DISTINCT FROM document#>'{football,rounds}' THEN
    PERFORM fanta.bar_replace_map('fanta.bar_football_round_cache','cache_key',document#>'{football,rounds}');
  END IF;
  IF previous IS NULL OR previous#>'{football,calendar,rounds}' IS DISTINCT FROM document#>'{football,calendar,rounds}' THEN
    PERFORM fanta.bar_replace_calendar(document#>'{football,calendar,rounds}');
  END IF;
END
$$;

-- Advance the revision in the same transaction as writes to any document section.
-- Skip the extra row version when this transaction has already updated the root.
CREATE FUNCTION fanta.bar_bump_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.fanta_state SET storage_shape=storage_shape
  WHERE id=1 AND storage_shape IS NOT NULL AND xmin<>pg_current_xact_id()::xid;
  RETURN NULL;
END
$$;

DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['bar_seriea_calendar_rounds','bar_seriea_matches','bar_matchdays',
    'bar_matchday_matches','bar_slips','bar_player_rewards','bar_player_profiles',
    'bar_credit_ledger','bar_league_state','bar_analysis_hashes','bar_football_round_cache']
  LOOP
    EXECUTE format('CREATE TRIGGER bar_bump_revision AFTER INSERT OR UPDATE OR DELETE ON fanta.%I
      FOR EACH STATEMENT EXECUTE FUNCTION fanta.bar_bump_revision()',target);
  END LOOP;
END
$$;

CREATE VIEW fanta.fanta_state AS
SELECT id,fanta.bar_restore_document(payload,storage_shape) AS payload,xmin::text AS storage_revision
FROM public.fanta_state WHERE storage_shape IS NOT NULL;

CREATE FUNCTION fanta.bar_update_document()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_revision text;
BEGIN
  IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Cannot change the Bar state identity'; END IF;
  -- Some compatibility callers already hold the root row. Fail fast instead
  -- of inverting the lock order with a targeted writer.
  IF NOT pg_try_advisory_xact_lock(826501) THEN
    RAISE EXCEPTION 'Bar state changed concurrently' USING ERRCODE='40001';
  END IF;
  SELECT xmin::text INTO current_revision FROM public.fanta_state WHERE id=OLD.id FOR UPDATE;
  IF current_revision IS DISTINCT FROM OLD.storage_revision THEN
    RAISE EXCEPTION 'Bar state changed concurrently' USING ERRCODE='40001';
  END IF;
  PERFORM fanta.bar_write_document(OLD.payload,NEW.payload);
  UPDATE public.fanta_state SET payload=fanta.bar_document_root(NEW.payload),
    storage_shape=fanta.bar_document_shape(NEW.payload) WHERE id=OLD.id;
  RETURN NEW;
END
$$;

CREATE TRIGGER bar_update_document INSTEAD OF UPDATE ON fanta.fanta_state
FOR EACH ROW EXECUTE FUNCTION fanta.bar_update_document();
