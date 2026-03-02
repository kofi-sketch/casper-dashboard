-- Enable Supabase Realtime on all dashboard tables
ALTER PUBLICATION supabase_realtime ADD TABLE dashboard_state;
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_history;
ALTER PUBLICATION supabase_realtime ADD TABLE content_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE content_research;
ALTER PUBLICATION supabase_realtime ADD TABLE content_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE target_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE email_subscribers;
ALTER PUBLICATION supabase_realtime ADD TABLE email_sends;
