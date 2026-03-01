CREATE TABLE IF NOT EXISTS content_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account text NOT NULL CHECK (account IN ('@gettraqd','@igobykofi')),
  content text NOT NULL,
  scheduled_at timestamptz,
  posted_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('scheduled','posted','draft')),
  post_id text,
  engagement_metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_research (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_handle text NOT NULL,
  author_followers bigint NOT NULL DEFAULT 0,
  post_preview text NOT NULL,
  post_url text NOT NULL,
  engagement_score numeric(10, 2) NOT NULL DEFAULT 0,
  found_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','queued','ignored')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_replies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_post_url text NOT NULL,
  target_author text NOT NULL,
  suggested_reply text NOT NULL,
  account text NOT NULL CHECK (account IN ('@gettraqd','@igobykofi')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','skipped')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS target_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  handle text NOT NULL UNIQUE,
  followers bigint NOT NULL DEFAULT 0,
  niche text NOT NULL,
  last_engaged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_content_posts" ON content_posts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "service_all_content_posts" ON content_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_content_research" ON content_research FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "service_all_content_research" ON content_research FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_content_replies" ON content_replies FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "service_all_content_replies" ON content_replies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_target_accounts" ON target_accounts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "service_all_target_accounts" ON target_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_content_posts_scheduled_at ON content_posts (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_posts_posted_at ON content_posts (posted_at);
CREATE INDEX IF NOT EXISTS idx_content_research_found_at ON content_research (found_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_replies_status ON content_replies (status);
CREATE INDEX IF NOT EXISTS idx_target_accounts_followers ON target_accounts (followers DESC);
