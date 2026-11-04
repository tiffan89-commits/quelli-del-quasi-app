CREATE TABLE IF NOT EXISTS fanta_state (
 id integer PRIMARY KEY CHECK(id=1),
 payload jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS fanta_login_limits (
 key text PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 1,
 window_start timestamptz NOT NULL DEFAULT now()
);
