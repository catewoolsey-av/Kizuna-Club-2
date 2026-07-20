-- =====================================================
-- KIZUNA CLUB DATABASE REBUILD
-- Run this in Supabase SQL Editor to completely rebuild
-- =====================================================

-- Drop existing tables (in order of dependencies)
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS member_investments CASCADE;
DROP TABLE IF EXISTS recruits CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS dinners CASCADE;
DROP TABLE IF EXISTS discussions CASCADE;
DROP TABLE IF EXISTS syndication_deals CASCADE;
DROP TABLE IF EXISTS fund_holdings CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS leadership CASCADE;

-- =====================================================
-- LEADERSHIP (AV Team)
-- =====================================================
CREATE TABLE leadership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ja TEXT,
  title TEXT,
  title_ja TEXT,
  emoji TEXT DEFAULT '👔',
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  bio TEXT,
  notable_investments TEXT,
  is_manager BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE leadership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON leadership FOR ALL USING (true) WITH CHECK (true);

-- Seed AV Team
INSERT INTO leadership (name, name_ja, title, title_ja, emoji, email, is_manager) VALUES
  ('Mike Collins', 'マイク・コリンズ', 'CEO', 'CEO', '👔', 'mike@av.vc', true),
  ('Michael Phillips', 'マイケル・フィリップス', 'Office Partner', 'オフィスパートナー', '🤝', 'mgp@av.vc', true),
  ('Yoshi Yamada', '山田 義久', 'Chairman, AV Japan', 'AV Japan 会長', '🎌', 'yoshihisa.yamada@av.vc', true),
  ('Ryan Nakata', '中田 ライアン', 'General Manager', 'ジェネラルマネージャー', '📊', 'ryan.nakata@av.vc', true),
  ('Ludwig Schulz', 'ルートヴィヒ・シュルツ', 'Partner', 'パートナー', '🌐', 'ludwig@av.vc', true);

-- =====================================================
-- MEMBERS (Club Members)
-- =====================================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  name_en TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  location TEXT DEFAULT 'Tokyo',
  linkedin TEXT,
  emoji TEXT DEFAULT '🏢',
  interests TEXT[],
  bio TEXT,
  is_board BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,
  deals_viewed INTEGER DEFAULT 0,
  sessions_attended INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON members FOR ALL USING (true) WITH CHECK (true);

-- Seed Sample Members
INSERT INTO members (name_en, name, email, company, title, location, emoji, interests, is_board) VALUES
  ('Takeshi Yamamoto', '山本 武', 'takeshi@yamamoto-holdings.jp', 'Yamamoto Holdings', 'President & CEO', 'Tokyo', '🏢', ARRAY['AI', 'Robotics', 'Healthcare'], false),
  ('Kenji Tanaka', '田中 健二', 'kenji@tanaka-capital.jp', 'Tanaka Capital', 'Managing Partner', 'Tokyo', '💹', ARRAY['FinTech', 'Deep Tech'], false),
  ('Hiroshi Sato', '佐藤 博', 'hiroshi@sato-ventures.jp', 'Sato Ventures', 'Founder', 'Osaka', '🚀', ARRAY['SaaS', 'Enterprise'], false),
  ('Yuki Watanabe', '渡辺 由紀', 'yuki@watanabe-group.jp', 'Watanabe Group', 'Chairman', 'Tokyo', '🌟', ARRAY['Consumer', 'Retail Tech'], false),
  ('Akira Suzuki', '鈴木 明', 'akira@suzuki-tech.jp', 'Suzuki Technologies', 'CTO', 'Nagoya', '🔬', ARRAY['AI', 'Cybersecurity'], false),
  ('Naomi Ito', '伊藤 直美', 'naomi@ito-capital.jp', 'Ito Capital Partners', 'General Partner', 'Tokyo', '💼', ARRAY['Healthcare', 'BioTech'], false),
  ('Masahiro Kobayashi', '小林 正弘', 'masahiro@kobayashi-ind.jp', 'Kobayashi Industries', 'CEO', 'Tokyo', '🏭', ARRAY['Manufacturing', 'Robotics'], false),
  ('Emi Nakamura', '中村 恵美', 'emi@nakamura-partners.jp', 'Nakamura & Partners', 'Senior Partner', 'Tokyo', '🎯', ARRAY['FinTech', 'InsurTech'], false);

-- =====================================================
-- FUND HOLDINGS (Portfolio Companies)
-- =====================================================
CREATE TABLE fund_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ja TEXT,
  sector TEXT,
  sector_ja TEXT,
  stage TEXT DEFAULT 'Series A',
  description TEXT,
  description_ja TEXT,
  valuation TEXT,
  logo TEXT DEFAULT '🚀',
  co_investors TEXT[],
  dd_complete BOOLEAN DEFAULT false,
  dd_reports JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fund_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON fund_holdings FOR ALL USING (true) WITH CHECK (true);

-- Seed Fund Holdings
INSERT INTO fund_holdings (name, sector, stage, description, valuation, logo, co_investors) VALUES
  ('NeuraTech AI', 'Enterprise AI', 'Series B', 'AI-powered enterprise automation platform', '$120M', '🤖', ARRAY['Sequoia', 'a16z']),
  ('GreenPower Energy', 'CleanTech', 'Series A', 'Next-generation battery technology', '$45M', '🌿', ARRAY['Breakthrough Energy', 'DCVC']),
  ('CyberShield', 'Cybersecurity', 'Series B', 'Zero-trust security platform for enterprises', '$85M', '🛡️', ARRAY['Accel', 'CrowdStrike']),
  ('QuantumLeap', 'Deep Tech', 'Seed', 'Quantum computing applications for finance', '$15M', '🔮', ARRAY['Founders Fund']),
  ('HealthBridge', 'HealthTech', 'Series A', 'AI diagnostics for preventive healthcare', '$35M', '🧬', ARRAY['a16z Bio', 'GV']),
  ('RoboLogix', 'Robotics', 'Series A', 'Warehouse automation robotics', '$50M', '🦾', ARRAY['Lux Capital', 'Eclipse']),
  ('PayFlow', 'FinTech', 'Series B', 'B2B payments infrastructure for Asia', '$95M', '💳', ARRAY['Tiger Global', 'Ribbit']),
  ('DataMesh', 'Data Infrastructure', 'Series A', 'Real-time data platform for enterprises', '$40M', '🌐', ARRAY['Index Ventures', 'Greylock']);

-- =====================================================
-- SYNDICATION DEALS (Investment Opportunities)
-- =====================================================
CREATE TABLE syndication_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ja TEXT,
  sector TEXT,
  sector_ja TEXT,
  stage TEXT DEFAULT 'Series A',
  description TEXT,
  description_ja TEXT,
  valuation TEXT,
  check_size TEXT,
  logo TEXT DEFAULT '⚡',
  co_investors TEXT[],
  dd_complete BOOLEAN DEFAULT false,
  dd_reports JSONB DEFAULT '[]'::jsonb,
  syndication_status TEXT DEFAULT 'active',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE syndication_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON syndication_deals FOR ALL USING (true) WITH CHECK (true);

-- Seed Syndication Deals
INSERT INTO syndication_deals (name, sector, stage, description, valuation, check_size, logo, co_investors, syndication_status) VALUES
  ('TechVision AI', 'Computer Vision', 'Series A', 'AI-powered visual inspection for manufacturing quality control', '$30M', '$50K', '👁️', ARRAY['Bessemer', 'IVP'], 'active'),
  ('CloudSecure', 'Cloud Security', 'Series B', 'Cloud-native security platform with AI threat detection', '$75M', '$100K', '☁️', ARRAY['Insight Partners'], 'active'),
  ('AgriTech Pro', 'AgTech', 'Seed', 'Precision agriculture using satellite imagery and ML', '$12M', '$25K', '🌾', ARRAY['Anterra Capital'], 'active');

-- =====================================================
-- DISCUSSIONS (Group Discussions)
-- =====================================================
CREATE TABLE discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_ja TEXT,
  description TEXT,
  description_ja TEXT,
  date DATE NOT NULL,
  time TEXT DEFAULT '19:00',
  timezone TEXT DEFAULT 'JST',
  host TEXT,
  topic TEXT,
  topic_ja TEXT,
  zoom_link TEXT,
  is_upcoming BOOLEAN DEFAULT true,
  rsvp_yes TEXT[] DEFAULT '{}',
  rsvp_no TEXT[] DEFAULT '{}',
  not_responded TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON discussions FOR ALL USING (true) WITH CHECK (true);

-- Seed Discussions
INSERT INTO discussions (title, title_ja, date, time, host, topic, topic_ja, description, description_ja, is_upcoming) VALUES
  ('AI Investment Thesis for 2026', '2026年AI投資テーゼ', '2026-02-12', '19:00', 'Mike Collins', 'AI / ML', 'AI / 機械学習', 'Deep dive into AI investment opportunities for the coming year', 'AI投資機会の深掘り', true),
  ('Deep Dive: Quantum Computing', '深掘り：量子コンピューティング', '2026-03-05', '19:00', 'Yoshi Yamada', 'Deep Tech', 'ディープテック', 'Understanding quantum computing investments and timeline', '量子コンピューティング投資', true),
  ('Japan FinTech Landscape', '日本フィンテック状況', '2026-04-02', '19:00', 'Ryan Nakata', 'FinTech', 'フィンテック', 'Overview of FinTech opportunities in Japan market', '日本市場のフィンテック機会', true);

-- =====================================================
-- DINNERS (Events)
-- =====================================================
CREATE TABLE dinners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_ja TEXT,
  date DATE NOT NULL,
  time TEXT DEFAULT '18:30',
  venue TEXT,
  venue_ja TEXT,
  capacity INTEGER DEFAULT 30,
  attendees TEXT[] DEFAULT '{}',
  not_attending TEXT[] DEFAULT '{}',
  not_responded TEXT[] DEFAULT '{}',
  is_upcoming BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dinners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON dinners FOR ALL USING (true) WITH CHECK (true);

-- Seed Dinners
INSERT INTO dinners (title, title_ja, date, time, venue, venue_ja, capacity, is_upcoming) VALUES
  ('Kizuna Spring Dinner 2026', '絆スプリングディナー2026', '2026-04-14', '18:30', 'The Capitol Hotel Tokyu', 'ザ・キャピトルホテル東急', 30, true),
  ('Kizuna Summer Networking', '絆サマーネットワーキング', '2026-07-15', '18:30', 'Aman Tokyo', 'アマン東京', 25, true),
  ('Kizuna Autumn Dinner 2026', '絆オータムディナー2026', '2026-10-20', '18:30', 'Palace Hotel Tokyo', 'パレスホテル東京', 30, true);

-- =====================================================
-- ANNOUNCEMENTS
-- =====================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_ja TEXT,
  content TEXT,
  content_ja TEXT,
  author TEXT,
  status TEXT DEFAULT 'published',
  pinned BOOLEAN DEFAULT false,
  scheduled_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON announcements FOR ALL USING (true) WITH CHECK (true);

-- Seed Announcements
INSERT INTO announcements (title, title_ja, content, content_ja, author, status, pinned, created_at) VALUES
  ('Welcome to Kizuna Club', '絆クラブへようこそ', 'We are excited to launch the Kizuna Club platform. This is your hub for deal flow, events, and community.', '絆クラブプラットフォームの発足をお喜び申し上げます。ディールフロー、イベント、コミュニティのハブです。', 'Mike Collins', 'published', true, '2025-12-01'),
  ('Q1 2026 Deal Pipeline', '2026年第1四半期ディールパイプライン', 'Our Q1 pipeline includes 3 new syndication opportunities in AI, CleanTech, and FinTech.', 'Q1パイプラインには、AI、クリーンテック、フィンテックの3つの新しいシンジケーション機会が含まれています。', 'Ryan Nakata', 'published', false, '2026-01-05');

-- =====================================================
-- RECRUITS (Pipeline)
-- =====================================================
CREATE TABLE recruits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  location TEXT,
  linkedin TEXT,
  source TEXT DEFAULT 'events',
  av_lead TEXT,
  stage TEXT DEFAULT 'prospect',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recruits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON recruits FOR ALL USING (true) WITH CHECK (true);

-- Seed Recruits
INSERT INTO recruits (name, email, company, location, source, av_lead, stage, notes) VALUES
  ('Taro Honda', 'taro@honda-group.jp', 'Honda Investment Group', 'Tokyo', 'events', 'Mike Collins', 'prospect', 'Met at Tokyo VC Summit'),
  ('Sakura Kimura', 'sakura@kimura-cap.jp', 'Kimura Capital', 'Osaka', 'av-team', 'Yoshi Yamada', 'sent-1-pager', 'Referral from Yoshi'),
  ('Ken Matsuda', 'ken@matsuda-holdings.jp', 'Matsuda Holdings', 'Tokyo', 'member', 'Ryan Nakata', 'discussed', 'Referred by Takeshi Yamamoto'),
  ('Yumi Ogawa', 'yumi@ogawa-ventures.jp', 'Ogawa Ventures', 'Nagoya', 'events', 'MGP', 'accepted', 'Ready for onboarding'),
  ('Ryu Ishikawa', 'ryu@ishikawa-tech.jp', 'Ishikawa Technologies', 'Tokyo', 'av-team', 'Mike Collins', 'prospect', 'Strong tech background');

-- =====================================================
-- MEMBER INVESTMENTS (Portfolio assignments)
-- =====================================================
CREATE TABLE member_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  deal_id UUID,
  member_name TEXT,
  deal_name TEXT,
  amount TEXT,
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE member_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON member_investments FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- ACTIVITY LOG
-- =====================================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  details TEXT,
  details_ja TEXT,
  user_name TEXT,
  user_email TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON activity_log FOR ALL USING (true) WITH CHECK (true);

-- Seed Activity Log
INSERT INTO activity_log (type, details, details_ja, user_name, timestamp) VALUES
  ('system', 'Database initialized', 'データベース初期化', 'System', NOW()),
  ('memberAdded', 'Added 8 founding members', '創設メンバー8名追加', 'Admin', NOW());

-- =====================================================
-- DONE
-- =====================================================
SELECT 'Database rebuild complete!' as status;
SELECT 'leadership' as table_name, COUNT(*) as rows FROM leadership
UNION ALL SELECT 'members', COUNT(*) FROM members
UNION ALL SELECT 'fund_holdings', COUNT(*) FROM fund_holdings
UNION ALL SELECT 'syndication_deals', COUNT(*) FROM syndication_deals
UNION ALL SELECT 'discussions', COUNT(*) FROM discussions
UNION ALL SELECT 'dinners', COUNT(*) FROM dinners
UNION ALL SELECT 'announcements', COUNT(*) FROM announcements
UNION ALL SELECT 'recruits', COUNT(*) FROM recruits;

-- Expected results:
-- leadership: 5
-- members: 8
-- fund_holdings: 8
-- syndication_deals: 3
-- discussions: 3
-- dinners: 3
-- announcements: 2
-- recruits: 5
