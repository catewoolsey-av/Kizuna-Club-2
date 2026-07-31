-- Add official company website fields and a weekly news feed cache.

ALTER TABLE fund_holdings
  ADD COLUMN IF NOT EXISTS company_website TEXT;

ALTER TABLE syndication_deals
  ADD COLUMN IF NOT EXISTS company_website TEXT;

CREATE TABLE IF NOT EXISTS news_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES fund_holdings(id) ON DELETE CASCADE,
  deal_name TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT NOT NULL,
  source_name TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  relevance_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (deal_id, source_url)
);

ALTER TABLE news_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON news_feed;
CREATE POLICY "Allow all" ON news_feed FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_news_feed_deal_id ON news_feed(deal_id);
CREATE INDEX IF NOT EXISTS idx_news_feed_published_at ON news_feed(published_at DESC);
