-- =====================================================
-- KIZUNA CLUB - ADD APPROXIMATE VALUATION FLAG
-- Run this in Supabase SQL Editor
-- =====================================================

-- Adds a valuation_approximate flag to fund_holdings and syndication_deals.
-- When true, the deal display shows a small note under the valuation:
-- "To be finalized, discussions around $X value".

ALTER TABLE fund_holdings
  ADD COLUMN IF NOT EXISTS valuation_approximate BOOLEAN DEFAULT false;

ALTER TABLE syndication_deals
  ADD COLUMN IF NOT EXISTS valuation_approximate BOOLEAN DEFAULT false;
