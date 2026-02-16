ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tournaments_config ON tournaments USING GIN (config);
