-- Remove board members from members table
DELETE FROM members WHERE is_board = true;

-- Verify they're gone
SELECT COUNT(*) as board_members_remaining FROM members WHERE is_board = true;

-- See current club members
SELECT id, name_en, email, company, is_board FROM members ORDER BY name_en;
