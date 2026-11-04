ALTER TABLE fanta.creation_jobs ADD COLUMN roster_mode text NOT NULL DEFAULT 'random' CHECK(roster_mode IN('random','empty'));
