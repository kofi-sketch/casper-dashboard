CREATE TABLE IF NOT EXISTS pipeline_history (
  id SERIAL PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  name TEXT NOT NULL,
  stages JSONB NOT NULL,
  completed_stages JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL,
  duration TEXT,
  tasks JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipeline_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow anonymous read" ON pipeline_history FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow service write" ON pipeline_history FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
