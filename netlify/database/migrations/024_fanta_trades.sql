CREATE TABLE fanta.trades (
 id uuid PRIMARY KEY,
 league_id text NOT NULL REFERENCES fanta.leagues(id) ON DELETE CASCADE,
 sender_team_id text NOT NULL,
 recipient_team_id text NOT NULL,
 sender_uid text NOT NULL,
 recipient_uid text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
 revision integer NOT NULL DEFAULT 1,
 terms jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (sender_team_id <> recipient_team_id AND sender_uid <> recipient_uid)
);

CREATE INDEX fanta_trades_sender ON fanta.trades (league_id, sender_uid, updated_at DESC);
CREATE INDEX fanta_trades_recipient ON fanta.trades (league_id, recipient_uid, updated_at DESC);
