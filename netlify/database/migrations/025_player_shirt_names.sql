ALTER TABLE fanta.players ADD COLUMN shirt_name text CHECK (shirt_name <> '' AND shirt_name = btrim(shirt_name));

CREATE FUNCTION fanta.initial_player_shirt_name(player_api_id integer, provider_name text, known_as text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT coalesce(
  CASE player_api_id
   -- The official match sheets list Douglas Luiz and Bremer by their playing names.
   WHEN 47522 THEN 'Douglas Luiz'
   WHEN 30497 THEN 'Bremer'
   WHEN 41585 THEN 'Gonçalo Ramos'
   WHEN 335056 THEN 'Diego Moreira'
   WHEN 272 THEN 'Rabiot'
   -- The Milan match sheets distinguish the two Terraccianos by initial.
   WHEN 264472 THEN 'F. Terracciano'
   WHEN 30394 THEN 'P. Terracciano'
   WHEN 30554 THEN 'Luca Pellegrini'
   WHEN 782 THEN 'Lorenzo Pellegrini'
   WHEN 446089 THEN 'Massimo Pessina'
   -- Names previously confirmed for the app.
   WHEN 135519 THEN 'Isaksen'
   WHEN 386305 THEN 'Ramón'
   WHEN 288112 THEN 'Kambwala'
   WHEN 474591 THEN 'Oulaï'
   -- Repair malformed characters in the stored provider labels.
   WHEN 400530 THEN 'Obrić'
   WHEN 340179 THEN 'Kovač'
   WHEN 398194 THEN 'Jovanović'
  END,
  nullif(normalize(btrim(known_as)), ''),
  nullif(normalize(btrim(regexp_replace(
   btrim(regexp_replace(replace(replace(replace(provider_name, '&apos;', ''''), '&#39;', ''''), '&rsquo;', '’'), '[[:space:][:cntrl:]]+', ' ', 'g')),
   '^([[:alpha:]][.] )+|( [[:alpha:]][.])+$', '', 'g'
  ))), '')
 );
$$;

UPDATE fanta.players SET shirt_name = fanta.initial_player_shirt_name(api_id, name, data->>'knownAs');

CREATE FUNCTION fanta.set_initial_player_shirt_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.shirt_name := coalesce(NEW.shirt_name, fanta.initial_player_shirt_name(NEW.api_id, NEW.name, NEW.data->>'knownAs'));
 RETURN NEW;
END;
$$;

-- Later provider upserts may change the legal or source name. Keep the stored shirt label.
CREATE TRIGGER player_initial_shirt_name BEFORE INSERT ON fanta.players
 FOR EACH ROW EXECUTE FUNCTION fanta.set_initial_player_shirt_name();
