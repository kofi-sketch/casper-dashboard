CREATE TABLE IF NOT EXISTS dashboard_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  state JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dashboard_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read" ON dashboard_state FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON dashboard_state FOR ALL USING (true);

INSERT INTO dashboard_state (id, state) VALUES (1, '{}') ON CONFLICT (id) DO NOTHING;
