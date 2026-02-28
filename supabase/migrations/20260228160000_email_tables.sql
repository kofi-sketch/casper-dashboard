-- Email subscribers table
CREATE TABLE IF NOT EXISTS email_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  signup_date date NOT NULL,
  current_stage int NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 8),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  created_at timestamptz DEFAULT now()
);

-- Email sends table
CREATE TABLE IF NOT EXISTS email_sends (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  email_number int NOT NULL CHECK (email_number BETWEEN 1 AND 8),
  sent_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed'))
);

-- RLS
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_subscribers" ON email_subscribers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all_subscribers" ON email_subscribers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_sends" ON email_sends FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all_sends" ON email_sends FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "service_all_subscribers" ON email_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_sends" ON email_sends FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed data
INSERT INTO email_subscribers (name, email, signup_date, current_stage, status) VALUES
  ('Stephanie', 'stephanie.nogales@gmail.com', '2026-02-28', 1, 'active'),
  ('Ulyses', 'support@cruvix.com', '2026-02-27', 1, 'active'),
  ('Tamia', 'tamia_henry@outlook.com', '2026-02-26', 1, 'active'),
  ('BOAKYE', 'dboakyhe@gmail.com', '2026-02-26', 1, 'active'),
  ('Lawyer', 'lawyerboadum@gmail.com', '2026-02-20', 1, 'active'),
  ('Curtis Kusi', 'management4ck@gmail.com', '2026-02-19', 1, 'active')
ON CONFLICT (email) DO NOTHING;
