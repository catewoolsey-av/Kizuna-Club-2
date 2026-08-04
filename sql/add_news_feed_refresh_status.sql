-- Track when the news feed refresh function last ran, so the UI can show
-- "Last refreshed" and mark articles from the most recent run as (new).

CREATE TABLE IF NOT EXISTS news_feed_refresh_status (
  id INT PRIMARY KEY DEFAULT 1,
  last_run_at TIMESTAMPTZ,
  CONSTRAINT news_feed_refresh_status_single_row CHECK (id = 1)
);

INSERT INTO news_feed_refresh_status (id, last_run_at)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE news_feed_refresh_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON news_feed_refresh_status;
CREATE POLICY "Allow all" ON news_feed_refresh_status FOR ALL USING (true) WITH CHECK (true);
