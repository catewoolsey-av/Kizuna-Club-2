-- =====================================================
-- KIZUNA CLUB - ADD LEADER "SHOW AS MEMBER" TOGGLE
-- Run this in Supabase SQL Editor
-- =====================================================

-- Adds a show_as_member flag to leadership.
-- When true, the leader is displayed in the Members row of the home
-- dashboard / community page (keeping their AV yellow profile color)
-- instead of in the Leadership row.

ALTER TABLE leadership
  ADD COLUMN IF NOT EXISTS show_as_member BOOLEAN DEFAULT false;
