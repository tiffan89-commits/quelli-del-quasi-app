CREATE OR REPLACE FUNCTION fanta.set_initial_player_shirt_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.shirt_name := coalesce(
  NEW.shirt_name,
  CASE WHEN NEW.api_id = 395559 THEN 'Alajbegović' END,
  fanta.initial_player_shirt_name(NEW.api_id, NEW.name, NEW.data->>'knownAs')
 );
 RETURN NEW;
END;
$$;

UPDATE fanta.players SET shirt_name = 'Alajbegović'
WHERE api_id = 395559 AND shirt_name IS DISTINCT FROM 'Alajbegović';
