-- =====================================================
-- KIZUNA CLUB - ADD BOARD MEMBERS
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Add is_board column to members table (if not exists)
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_board BOOLEAN DEFAULT false;

-- Step 2: Insert board members into members table
-- (They need to exist here for the app to load their profile)

INSERT INTO members (name, name_en, email, company, geography, interests, emoji, is_board, last_login)
VALUES 
  ('Errik Anderson', 'Errik Anderson', 'errik.anderson@alloytx.com', 'Alloy TX', 'USA', ARRAY['Board'], '👔', true, NOW()),
  ('Luke Antal', 'Luke Antal', 'luke@av.vc', 'Alumni Ventures', 'USA', ARRAY['Board'], '📊', true, NOW()),
  ('Matt Blumberg', 'Matt Blumberg', 'matt@myblumberg.com', 'Bolster', 'USA', ARRAY['Board'], '💼', true, NOW()),
  ('Mark Edwards', 'Mark Edwards', 'mark.edwards@av.vc', 'Alumni Ventures', 'USA', ARRAY['Board'], '📈', true, NOW()),
  ('Jim Gill', 'Jim Gill', 'jimgillw@gmail.com', 'Board Member', 'USA', ARRAY['Board'], '🎯', true, NOW()),
  ('Peter Graham', 'Peter Graham', 'peter@1bv.co', '1BV', 'USA', ARRAY['Board'], '🚀', true, NOW()),
  ('Lauren Kolodny', 'Lauren Kolodny', 'laurenkolodny@gmail.com', 'Accel', 'USA', ARRAY['Board'], '⭐', true, NOW()),
  ('David Muson', 'David Muson', 'david.muson@av.vc', 'Alumni Ventures', 'USA', ARRAY['Board'], '📋', true, NOW()),
  ('Beth Obermiller', 'Beth Obermiller', 'beth@avgfunds.com', 'AV Funds', 'USA', ARRAY['Board'], '💡', true, NOW()),
  ('Michael Phillips', 'Michael Phillips', 'mgp@av.vc', 'Alumni Ventures', 'USA', ARRAY['Board'], '🤝', true, NOW()),
  ('Andrew Ressler', 'Andrew Ressler', 'andrew.ressler@av.vc', 'Alumni Ventures', 'USA', ARRAY['Board'], '📊', true, NOW()),
  ('Laura Rippy', 'Laura Rippy', 'laura@av.vc', 'Alumni Ventures', 'USA', ARRAY['Board'], '🌟', true, NOW()),
  ('Ludwig Schulze', 'Ludwig Schulze', 'ludwig@waterman-ventures.com', 'Waterman Ventures', 'Germany', ARRAY['Board'], '🇩🇪', true, NOW()),
  ('Drew Wandzilak', 'Drew Wandzilak', 'drew@av.vc', 'Alumni Ventures', 'USA', ARRAY['Board'], '📈', true, NOW())
ON CONFLICT (email) DO UPDATE SET 
  is_board = true,
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en;

-- Step 3: Create auth users for board members with shared password
-- NOTE: Run these one at a time if you get errors, or skip existing users

-- You need to use the Supabase Dashboard > Authentication > Users > Add user
-- OR use the service role key with this approach:

-- For each board member, Supabase needs an auth.users entry
-- The easiest way is through the Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add user" 
-- 3. Enter email and password: Kizuna 2026!
-- 4. Check "Auto Confirm User"
-- 5. Repeat for each board member

-- Alternatively, if you have access to auth schema (requires service role):
-- This SQL creates the auth users directly:

/*
-- WARNING: Only run if you have service_role access
-- These create auth users with the password "Kizuna 2026!"

SELECT auth.create_user(
  email := 'errik.anderson@alloytx.com',
  password := 'Kizuna 2026!',
  email_confirm := true
);

SELECT auth.create_user(
  email := 'luke@av.vc', 
  password := 'Kizuna 2026!',
  email_confirm := true
);

-- ... repeat for each email
*/

-- =====================================================
-- VERIFICATION QUERY
-- Run this to confirm board members were added:
-- =====================================================

SELECT email, name_en, company, is_board 
FROM members 
WHERE is_board = true 
ORDER BY name_en;
