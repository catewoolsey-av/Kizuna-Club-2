-- =====================================================
-- KIZUNA CLUB - ADD EVENT END DATES (date ranges)
-- Run this in Supabase SQL Editor
-- =====================================================

-- Adds an optional end_date to discussions and dinners.
-- When end_date is null or equal to date, the event is treated as a single day.
-- Otherwise the UI displays the range (date – end_date).

ALTER TABLE discussions
  ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE dinners
  ADD COLUMN IF NOT EXISTS end_date DATE;
