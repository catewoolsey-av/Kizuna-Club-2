-- =====================================================
-- KIZUNA CLUB - ADD LEADER PROFILE VISIBILITY
-- Run this in Supabase SQL Editor
-- =====================================================

-- Adds a profile_visible flag to leadership.
-- When false, the leader's circle is hidden from the home dashboard
-- and the community/members page. They can still log in and use the portal.

ALTER TABLE leadership
  ADD COLUMN IF NOT EXISTS profile_visible BOOLEAN DEFAULT true;

UPDATE leadership SET profile_visible = true WHERE profile_visible IS NULL;
