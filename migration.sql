--
-- PostgreSQL database dump
--

\restrict ahuZBRJgR5JgTORYeTf6o0iLNGOm0ggiV20Ps2fRvHIZpugMQ9HYufwNGkgx6IS

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.8 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: current_user_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_email() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN user_email;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_email TEXT;
  admin_status BOOLEAN;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  SELECT auth_users.is_admin INTO admin_status FROM auth_users WHERE auth_users.email = user_email;
  RETURN COALESCE(admin_status, false);
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_uuid_array(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_uuid_array(arr text[]) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
BEGIN
  IF arr IS NULL OR array_length(arr, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check each element is a valid UUID format
  RETURN NOT EXISTS (
    SELECT 1 
    FROM unnest(arr) AS id 
    WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
END;
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text,
    details text,
    details_ja text,
    user_name text,
    user_email text,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: deal_interests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deal_interests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL,
    deal_name text NOT NULL,
    member_id uuid,
    member_name text NOT NULL,
    member_email text NOT NULL,
    interest_type text NOT NULL,
    message text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT deal_interests_interest_type_check CHECK ((interest_type = ANY (ARRAY['learn_more'::text, 'invest'::text]))),
    CONSTRAINT deal_interests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'contacted'::text, 'completed'::text, 'declined'::text])))
);


--
-- Name: admin_deal_interests; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_deal_interests AS
 SELECT id,
    deal_id,
    deal_name,
    member_id,
    member_name,
    member_email,
    interest_type,
    message,
    status,
    created_at,
    updated_at,
    count(*) OVER (PARTITION BY deal_id) AS total_interest_count,
    count(*) FILTER (WHERE (interest_type = 'invest'::text)) OVER (PARTITION BY deal_id) AS invest_count
   FROM public.deal_interests di
  ORDER BY created_at DESC;


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    title_ja text,
    content text,
    content_ja text,
    author text,
    status text DEFAULT 'published'::text,
    pinned boolean DEFAULT false,
    scheduled_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: archived_deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archived_deals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    original_id uuid,
    deal_type text,
    name text NOT NULL,
    name_ja text,
    sector text,
    stage text,
    data jsonb,
    archived_at timestamp with time zone DEFAULT now(),
    archived_by text
);


--
-- Name: co_investors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.co_investors (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    name_ja text,
    firm text,
    firm_ja text,
    bio text,
    bio_ja text,
    notable_investments text[] DEFAULT '{}'::text[],
    connection_strength text DEFAULT 'Medium'::text,
    emoji text DEFAULT '🤝'::text,
    coinvests_with text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dinners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dinners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    title_ja text,
    date date NOT NULL,
    "time" text DEFAULT '18:30'::text,
    venue text,
    venue_ja text,
    capacity integer DEFAULT 30,
    attendees text[] DEFAULT '{}'::text[],
    not_attending text[] DEFAULT '{}'::text[],
    not_responded text[] DEFAULT '{}'::text[],
    is_upcoming boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    end_date date,
    CONSTRAINT dinners_attendees_valid CHECK (public.validate_uuid_array(attendees)),
    CONSTRAINT dinners_not_attending_valid CHECK (public.validate_uuid_array(not_attending)),
    CONSTRAINT dinners_not_responded_valid CHECK (public.validate_uuid_array(not_responded))
);


--
-- Name: discussions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    title_ja text,
    description text,
    description_ja text,
    date date NOT NULL,
    "time" text DEFAULT '19:00'::text,
    timezone text DEFAULT 'JST'::text,
    host text,
    topic text,
    topic_ja text,
    zoom_link text,
    is_upcoming boolean DEFAULT true,
    rsvp_yes text[] DEFAULT '{}'::text[],
    rsvp_no text[] DEFAULT '{}'::text[],
    not_responded text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    meeting_url text,
    end_date date,
    CONSTRAINT discussions_not_responded_valid CHECK (public.validate_uuid_array(not_responded)),
    CONSTRAINT discussions_rsvp_no_valid CHECK (public.validate_uuid_array(rsvp_no)),
    CONSTRAINT discussions_rsvp_yes_valid CHECK (public.validate_uuid_array(rsvp_yes))
);


--
-- Name: fund_holdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_holdings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    name_ja text,
    sector text,
    sector_ja text,
    stage text DEFAULT 'Series A'::text,
    description text,
    description_ja text,
    valuation text,
    logo text DEFAULT '🚀'::text,
    co_investors text[] DEFAULT '{}'::text[],
    dd_complete boolean DEFAULT false,
    dd_reports jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    sort_order integer DEFAULT 0,
    meeting_url text,
    year_established integer,
    city text,
    country text,
    is_pre_money boolean DEFAULT false,
    check_size text,
    memo_url text,
    deck_url text,
    additional_media jsonb DEFAULT '[]'::jsonb,
    valuation_approximate boolean DEFAULT false
);


--
-- Name: leadership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leadership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    title text,
    emoji text DEFAULT '👔'::text,
    email text,
    phone text,
    linkedin text,
    bio text,
    notable_investments text,
    is_manager boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    co_invests_with text[] DEFAULT '{}'::text[],
    company text,
    location text,
    auth_user_id uuid,
    must_change_password boolean DEFAULT false,
    profile_visible boolean DEFAULT true,
    show_as_member boolean DEFAULT false
);


--
-- Name: member_investments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_investments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    deal_id uuid,
    member_name text,
    deal_name text,
    amount text,
    date date,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    email text,
    phone text,
    company text,
    title text,
    location text DEFAULT 'Tokyo'::text,
    linkedin text,
    emoji text DEFAULT '🏢'::text,
    interests text[] DEFAULT '{}'::text[],
    bio text,
    is_board boolean DEFAULT false,
    last_login timestamp with time zone,
    deals_viewed integer DEFAULT 0,
    sessions_attended integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    auth_user_id uuid,
    must_change_password boolean DEFAULT false
);


--
-- Name: recruits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    company text,
    location text,
    linkedin text,
    source text DEFAULT 'events'::text,
    av_lead text,
    stage text DEFAULT 'prospect'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: syndication_deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.syndication_deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    name_ja text,
    sector text,
    sector_ja text,
    stage text DEFAULT 'Series A'::text,
    description text,
    description_ja text,
    valuation text,
    check_size text,
    logo text DEFAULT '⚡'::text,
    co_investors text[] DEFAULT '{}'::text[],
    dd_complete boolean DEFAULT false,
    dd_reports jsonb DEFAULT '[]'::jsonb,
    syndication_status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    sort_order integer DEFAULT 0,
    meeting_url text,
    year_established integer,
    city text,
    country text,
    is_pre_money boolean DEFAULT false,
    memo_url text,
    deck_url text,
    additional_media jsonb DEFAULT '[]'::jsonb,
    valuation_approximate boolean DEFAULT false
);


--
-- Data for Name: activity_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_log (id, type, details, details_ja, user_name, user_email, "timestamp") FROM stdin;
823d5d31-10bf-4fc4-904f-7aac29f40676	recruitAdded	Added recruit: Tony Min	リクルート追加: Tony Min	Admin	admin@av.vc	2026-01-13 19:37:58.894+00
a4c8341b-e9b2-4f88-b1b2-9d41a12e5f2f	recruitEdited	Tony Min → Prospect	Tony Min → Prospect	Admin	admin@av.vc	2026-01-13 19:38:00.144+00
b142b8cc-14c4-4266-b4a3-9da94a5f5a23	recruitEdited	Tony Min → Discussed	Tony Min → Discussed	Admin	admin@av.vc	2026-01-13 19:38:01.102+00
dbd9dff3-1b3f-4efc-be3b-eb6d44be23f5	recruitEdited	Tony Min → Accepted	Tony Min → Accepted	Admin	admin@av.vc	2026-01-13 19:38:01.81+00
6d892c45-b39f-47e7-b443-d8a971ec21df	recruitEdited	Tony Min → Uploaded	Tony Min → Uploaded	Admin	admin@av.vc	2026-01-13 19:38:02.527+00
1a74a08a-3e43-4fda-aea1-8e5ba8add329	recruitEdited	Tony Min → Accepted	Tony Min → Accepted	Admin	admin@av.vc	2026-01-13 19:38:03.811+00
a4fa8b12-d324-495d-b321-a03841321e89	recruitDeleted	Deleted recruit: Tony Min	リクルート削除: Tony Min	Admin	admin@av.vc	2026-01-13 19:38:06.736+00
fa4db7d2-0628-4ffa-810e-395cc88f740b	teamMemberEdited	Edited team member: Mike Collins	Team member edited: Mike Collins	Admin	admin@av.vc	2026-01-13 19:38:12.344+00
07d72093-4120-469b-98df-c745193e3ab0	teamMemberAdded	Added team member: Tony Min	Team member added: Tony Min	Admin	admin@av.vc	2026-01-13 20:08:51.21+00
86bb922f-ad43-41d1-971e-12626ce4b3d5	teamMemberAdded	Added team member: Tony	Team member added: Tony	Admin	admin@av.vc	2026-01-13 20:12:05.246+00
e03ecc31-4c04-4f2c-a64e-78caf56beba5	teamMemberDeleted	Deleted team member: Tony	Team member deleted: Tony	Admin	admin@av.vc	2026-01-13 20:12:38.041+00
7af0d90f-50a9-494c-8136-a80014332c5d	recruitAdded	Added recruit: Tony Min	リクルート追加: Tony Min	Admin	admin@av.vc	2026-01-13 20:13:08.213+00
3fd81cfa-17a5-4e16-8e43-c472ada16dee	recruitEdited	Tony Min → Sent 1 Pager	Tony Min → Sent 1 Pager	Admin	admin@av.vc	2026-01-13 20:13:09.975+00
f4e1dada-dad1-4b52-b44b-4c319000e450	recruitEdited	Tony Min → Accepted	Tony Min → Accepted	Admin	admin@av.vc	2026-01-13 20:13:11.364+00
d78a6a5a-91c3-40fe-bbbe-d7b5ae6729fd	recruitEdited	Tony Min → Discussed	Tony Min → Discussed	Admin	admin@av.vc	2026-01-13 20:13:12.431+00
073a0f81-b7be-483d-a993-197b2ca3f0d7	recruitEdited	Tony Min → Prospect	Tony Min → Prospect	Admin	admin@av.vc	2026-01-13 20:13:13.6+00
be4c8cb6-d723-470f-b663-a1930cd756b2	recruitEdited	Tony Min → Sent 1 Pager	Tony Min → Sent 1 Pager	Admin	admin@av.vc	2026-01-13 20:13:19.001+00
04cba48e-8e5a-4217-b408-c243c615c92b	recruitDeleted	Deleted recruit: Tony Min	リクルート削除: Tony Min	Admin	admin@av.vc	2026-01-13 20:13:29.648+00
076e7f34-e1ff-4b89-81a1-279965aed2ca	recruitDeleted	Deleted recruit: Tony Min	リクルート削除: Tony Min	Admin	admin@av.vc	2026-01-14 18:12:25.179+00
5716b00b-d86e-41fc-a8df-f1659fd9233a	recruitDeleted	Deleted recruit: Mr Frog	リクルート削除: Mr Frog	Cate Woolsey	\N	2026-02-06 17:34:01.639+00
46452a7f-06e3-4d61-9046-856dbf76d903	memberDeleted	Deleted member: Mr Frog	Member deleted: Mr Frog	Cate Woolsey	\N	2026-02-06 17:34:32.132+00
f8e46451-2a28-421f-8861-bfd8c05fd1e3	memberDeleted	Deleted member: Dylan	Member deleted: Dylan	Cate Woolsey	\N	2026-02-06 17:35:35.407+00
e24fb7d1-a2b9-4134-955b-3e0ed637724c	recruitAdded	Added recruit: dylan	リクルート追加: dylan	Cate Woolsey	\N	2026-02-06 17:36:14.39+00
eda3373e-574b-4550-8d13-8b834193510a	memberAdded	Auto-created member for accepted recruit: dylan	Auto-created member for accepted recruit: dylan	Cate Woolsey	\N	2026-02-06 17:36:17.159+00
e33cb5fb-d60a-466b-863d-47911b023b41	recruitEdited	dylan → Accepted	dylan → Accepted	Cate Woolsey	\N	2026-02-06 17:36:17.159+00
5a0e0031-d476-420c-bff5-4312623fec5a	memberDeleted	Deleted member: dylan	Member deleted: dylan	Cate Woolsey	\N	2026-02-06 17:36:37.413+00
5fb15e03-9b57-4ca0-abfd-7ffae394a993	memberAdded	Converted dylan to member	dylanをメンバーに変換	Cate Woolsey	\N	2026-02-06 17:41:21.902+00
d20bd3b4-65d7-48e3-a6e8-7119e5c9f3d8	recruitDeleted	Deleted recruit: dylan	リクルート削除: dylan	Cate Woolsey	\N	2026-02-06 17:42:53.903+00
316e82ec-c724-4e51-b36a-5824c71b7ead	memberAdded	Added member: Dylan	Added member: Dylan	Cate Woolsey	\N	2026-02-06 17:43:11.099+00
59b0627f-958c-42c7-840a-3d552e459487	memberDeleted	Deleted member: Dylan	Member deleted: Dylan	Cate Woolsey	\N	2026-02-06 17:45:29.983+00
238e8857-cd3d-4778-b344-caa4ca0bcf98	memberAdded	Added member: Dylan Fagan	Added member: Dylan Fagan	Cate Woolsey	\N	2026-02-06 17:45:48.083+00
243084de-db67-4c04-a664-69d7609ac9d0	recruitEdited	Dylan Fagan → Discussed	Dylan Fagan → Discussed	Cate Woolsey	\N	2026-02-06 17:46:04.51+00
e1cc0843-88e6-4383-9452-8232d8acaffc	recruitEdited	Dylan Fagan → Accepted	Dylan Fagan → Accepted	Cate Woolsey	\N	2026-02-06 17:46:09.405+00
a8fdd25a-480d-41a7-aba6-3218fefab2a5	recruitEdited	Dylan Fagan → Has Account	Dylan Fagan → Has Account	Cate Woolsey	\N	2026-02-06 17:57:08.743+00
ffa8d64f-8fa4-4603-9664-b7aa7b6b2ff5	recruitEdited	Dylan Fagan → Invested	Dylan Fagan → Invested	Cate Woolsey	\N	2026-02-06 17:57:15.454+00
11784c65-91dd-473e-b5d9-00a820fe799a	recruitEdited	Dylan Fagan → Has Account	Dylan Fagan → Has Account	Cate Woolsey	\N	2026-02-06 17:57:16.74+00
74447747-e1e0-4624-9bbd-a806ebbbb2a2	recruitEdited	Dylan Fagan → Accepted	Dylan Fagan → Accepted	Cate Woolsey	\N	2026-02-06 17:57:18.634+00
348ca171-3f93-4397-ac8a-89588ff167cc	recruitEdited	Dylan Fagan → Has Account	Dylan Fagan → Has Account	Cate Woolsey	\N	2026-02-06 17:57:19.531+00
dca4ca48-8c63-4b00-965c-5846d7d76ab2	recruitEdited	Dylan Fagan → Accepted	Dylan Fagan → Accepted	Cate Woolsey	\N	2026-02-06 17:57:21.061+00
86ef45e7-2719-4551-a30d-6ec032b42994	memberDeleted	Deleted member: Dylan Fagan	Member deleted: Dylan Fagan	Cate Woolsey	\N	2026-02-06 17:59:16.476+00
89799a97-73ae-45c8-ad33-564ccc5a79e3	dealEdited	Edited deal: Orion Security	Edited deal: Orion Security	Cate Woolsey	\N	2026-02-08 15:14:41.348+00
eae9d6de-3e11-4b7f-b0ca-d76c458efd47	dealEdited	Edited deal: Test Syndication	Edited deal: Test Syndication	Cate Woolsey	\N	2026-02-08 15:14:47.369+00
0d76e0c6-87e9-4a85-837c-25c4a4be8c7d	dealEdited	Edited deal: Orion Security	Edited deal: Orion Security	Cate Woolsey	\N	2026-02-08 15:24:05.89+00
edd031b0-32bd-48ea-8fd6-13c9104c77e3	dealEdited	Edited deal: Test Syndication	Edited deal: Test Syndication	Cate Woolsey	\N	2026-02-08 15:24:14.77+00
dee5378e-3f15-4328-af0a-03e58c92cd1f	teamMemberDeleted	Deleted team member: Tony Min	Team member deleted: Tony Min	Cate Woolsey	\N	2026-02-08 17:24:02.453+00
3da5a8ff-d426-405c-b14c-aa920b861603	leaderAdded	Added leader: tony min	Added leader: tony min	Cate Woolsey	\N	2026-02-08 17:28:48.633+00
81ea976e-3142-4f2a-961e-17fcb3916fb9	authAccountCreated	Created auth account for: tony min	Created auth account for: tony min	Cate Woolsey	\N	2026-02-08 17:29:11.979+00
f0997a46-eaf2-44f6-abe6-35698e956c3b	teamMemberDeleted	Deleted team member: tony min	Team member deleted: tony min	Cate Woolsey	\N	2026-02-08 17:29:17.466+00
4470706c-d76f-4f83-a3f0-283a4887a846	leaderAdded	Added leader: Tony	Added leader: Tony	Cate Woolsey	\N	2026-02-08 17:29:54.312+00
3889e05f-d302-4861-8ace-1c91229775c7	authAccountCreated	Created auth account for: Tony	Created auth account for: Tony	Cate Woolsey	\N	2026-02-08 17:30:12.512+00
3c2816f6-781e-420c-a627-3c7cb9a734eb	teamMemberDeleted	Deleted team member: Tony	Team member deleted: Tony	Cate Woolsey	\N	2026-02-08 17:31:47.411+00
2e073e80-1bbe-4f8c-9d24-df8d68835714	memberAdded	Added member: Dylan Member	Added member: Dylan Member	Cate Woolsey	\N	2026-02-08 17:32:07.663+00
378ac20b-4877-4bfa-a7f8-707eb0de852c	authAccountCreated	Created auth account for: Dylan Member	Created auth account for: Dylan Member	Cate Woolsey	\N	2026-02-08 17:32:17.983+00
7cc5bb3e-2381-4c7b-8aa7-0fa9601509b5	memberDeleted	Deleted member: Dylan Member	Member deleted: Dylan Member	Cate Woolsey	\N	2026-02-08 17:33:41.868+00
6fd444f8-6bce-4be0-9fde-3660ee629a43	leaderAdded	Added leader: Yoshi Yamada	Added leader: Yoshi Yamada	Cate Woolsey	\N	2026-02-08 17:46:00.17+00
71a05905-bc56-4a49-87b4-3db593716322	authAccountCreated	Created auth account for: Yoshi Yamada	Created auth account for: Yoshi Yamada	Cate Woolsey	\N	2026-02-08 17:46:42.07+00
34f9dddc-8211-4b74-b019-d24c15e0ffa3	leaderAdded	Added leader: Ryan Nakata	Added leader: Ryan Nakata	Cate Woolsey	\N	2026-02-08 17:49:55.31+00
d4ec82fd-a626-48b7-a5b8-e042d529bb2a	authAccountCreated	Created auth account for: Ryan Nakata	Created auth account for: Ryan Nakata	Cate Woolsey	\N	2026-02-08 17:50:02.752+00
eb22d368-c058-4232-9adb-acf2b3d60880	leaderAdded	Added leader: Ayla Langer	Added leader: Ayla Langer	Cate Woolsey	\N	2026-02-08 17:50:47.309+00
7d688e8b-aec3-4007-bd3a-923f13a39bf2	leaderEdited	Edited leader: Ayla Langer	Edited leader: Ayla Langer	Cate Woolsey	\N	2026-02-08 17:51:29.156+00
925e0813-6538-451c-86ef-3c6dec7ffba0	authAccountCreated	Created auth account for: Ayla Langer	Created auth account for: Ayla Langer	Cate Woolsey	\N	2026-02-08 17:51:34.363+00
9d83d094-eddc-4e04-b13a-a31f1fd5fdd1	leaderAdded	Added leader: Mike Collins	Added leader: Mike Collins	Cate Woolsey	\N	2026-02-08 17:52:05.473+00
b3ea4d82-a32d-402f-897f-66ace6edeb02	authAccountCreated	Created auth account for: Mike Collins	Created auth account for: Mike Collins	Cate Woolsey	\N	2026-02-08 17:52:35.69+00
a6854be4-c8da-4847-bee2-516a40668097	memberAdded	Added member: Akira Suzuki	Added member: Akira Suzuki	Cate Woolsey	\N	2026-02-08 17:53:35.35+00
a69a4696-1088-4e01-9bef-1046b0e2c942	authAccountCreated	Created auth account for: Akira Suzuki	Created auth account for: Akira Suzuki	Cate Woolsey	\N	2026-02-08 17:53:45.49+00
73a60692-1851-4f53-a793-2dc3b4b670ef	memberAdded	Added member: Masahiro Kobayashi	Added member: Masahiro Kobayashi	Cate Woolsey	\N	2026-02-08 17:54:27.687+00
c5ad90bb-ea45-404e-a9e7-f834b66d47ab	memberEdited	Edited member: Akira Suzuki	Edited member: Akira Suzuki	Cate Woolsey	\N	2026-02-08 17:54:34.002+00
4a328f8c-73e3-45e1-9df7-9cf1c2b93e1c	authAccountCreated	Created auth account for: Masahiro Kobayashi	Created auth account for: Masahiro Kobayashi	Cate Woolsey	\N	2026-02-08 17:54:44.173+00
66431795-8166-48fa-b7fb-30bed1629ea8	memberAdded	Added member: Naomi Ito	Added member: Naomi Ito	Cate Woolsey	\N	2026-02-08 17:55:08.699+00
a84a646e-131e-4d46-84ce-afa9a57ad7c3	authAccountCreated	Created auth account for: Naomi Ito	Created auth account for: Naomi Ito	Cate Woolsey	\N	2026-02-08 17:55:18.552+00
73b2c862-e636-4762-a681-db088df6ab8d	memberAdded	Added member: Yuki Watanabe	Added member: Yuki Watanabe	Cate Woolsey	\N	2026-02-08 17:55:54.6+00
3e15c5d0-152d-4ca0-9416-d47ce41530a5	authAccountCreated	Created auth account for: Yuki Watanabe	Created auth account for: Yuki Watanabe	Cate Woolsey	\N	2026-02-08 17:56:03.479+00
77dda3ab-f6cf-49b4-ad67-bf730cf4ff3f	memberAdded	Added member: Hiroshi Sato	Added member: Hiroshi Sato	Cate Woolsey	\N	2026-02-08 17:56:28.518+00
b6e66e65-2c0b-4edb-9ce5-c6bb7b7276e3	authAccountCreated	Created auth account for: Hiroshi Sato	Created auth account for: Hiroshi Sato	Cate Woolsey	\N	2026-02-08 17:56:39.691+00
802bc26c-c2ff-4841-b926-eeacb3cadee8	memberAdded	Added member: Emi Nakamura	Added member: Emi Nakamura	Cate Woolsey	\N	2026-02-08 17:57:00.373+00
96482217-8150-4c31-9bab-44d1964b4a09	memberDeleted	Deleted member: Emi Nakamura	Member deleted: Emi Nakamura	Cate Woolsey	\N	2026-02-08 17:57:23.958+00
adf2de06-0d42-4f37-977c-4a87ac09b6ae	memberAdded	Added member: Emi Nakamura	Added member: Emi Nakamura	Cate Woolsey	\N	2026-02-08 17:57:56.91+00
7ad06447-6cf8-4f25-bbee-290045497522	authAccountCreated	Created auth account for: Emi Nakamura	Created auth account for: Emi Nakamura	Cate Woolsey	\N	2026-02-08 17:58:02.781+00
ae62edeb-f73e-4cfc-bc2a-15d98d4f2f00	memberAdded	Added member: Kenji Tanaka	Added member: Kenji Tanaka	Cate Woolsey	\N	2026-02-08 17:58:28.762+00
bb7a1a5b-214b-41a9-bb84-dc1c7aaa27ba	memberDeleted	Deleted member: Takeshi Yamamoto	Member deleted: Takeshi Yamamoto	Cate Woolsey	\N	2026-02-08 17:59:40.722+00
45cdeeec-e7d4-4c23-b09d-2c04748a7e44	memberAdded	Added member: Takeshi Yamamoto	Added member: Takeshi Yamamoto	Cate Woolsey	\N	2026-02-08 17:59:41.127+00
11518379-1830-4dd4-8ec1-d41e252431c8	memberAdded	Added member: Takeshi Yamamoto	Added member: Takeshi Yamamoto	Cate Woolsey	\N	2026-02-08 17:59:41.202+00
322c45b1-32db-4945-a1b9-26d3a4cd8024	dealEdited	Edited deal: Test Syndication	Edited deal: Test Syndication	Cate Woolsey	\N	2026-02-09 20:47:37.599+00
776d053f-a4dd-4f5e-bbba-4597e249b069	dealEdited	Edited deal: Test Syndication	Edited deal: Test Syndication	Cate Woolsey	\N	2026-02-09 20:54:24.722+00
cc948479-899b-483e-b2bd-f9716848af3b	dealEdited	Edited deal: Test Syndication	Edited deal: Test Syndication	Cate Woolsey	\N	2026-02-09 20:59:31.941+00
055e13f1-57b5-46d1-bdf2-7da0cca76356	recruitDeleted	Deleted recruit: Takeshi Yamamoto	リクルート削除: Takeshi Yamamoto	Cate Woolsey	\N	2026-02-09 21:02:50.045+00
5b2dbf37-c89b-4325-842a-8d0e2704160a	memberAdded	Converted Takeshi Yamamoto to member	Takeshi Yamamotoをメンバーに変換	Cate Woolsey	\N	2026-02-09 21:02:53.07+00
e5a2894d-4ec0-440b-8736-b37904eac575	authAccountCreated	Created auth account for: Takeshi Yamamoto	Created auth account for: Takeshi Yamamoto	Cate Woolsey	\N	2026-02-09 21:07:37.665+00
814baa9e-19a2-4cdd-acea-c75ae9e8aad9	memberAdded	Added member: Takeshi Yamamoto	Added member: Takeshi Yamamoto	Cate Woolsey	\N	2026-02-09 21:10:00.155+00
55d8c446-b77f-419b-9148-b6dd6b1df658	authAccountCreated	Created auth account for: Takeshi Yamamoto	Created auth account for: Takeshi Yamamoto	Cate Woolsey	\N	2026-02-09 21:10:11.007+00
07ef91e8-10f1-47c9-870b-776d459033d4	memberAdded	Added member: Tony Min	Added member: Tony Min	Cate Woolsey	\N	2026-02-11 16:50:25.095+00
e80f043a-07c8-41c4-8c2c-feb7d5e64f42	authAccountCreated	Created auth account for: Tony Min	Created auth account for: Tony Min	Cate Woolsey	\N	2026-02-11 16:50:44.848+00
24bbc09f-5324-422b-8103-82d79bdb9de1	memberDeleted	Deleted member: Akira Suzuki	Member deleted: Akira Suzuki	Cate Woolsey	\N	2026-03-19 12:42:42.91+00
a96ef5e5-2afe-4582-ae41-9093823f043a	memberDeleted	Deleted member: Masahiro Kobayashi	Member deleted: Masahiro Kobayashi	Cate Woolsey	\N	2026-03-19 12:42:46.027+00
40aff828-d930-48e5-a3ae-a006f4216a53	memberDeleted	Deleted member: Naomi Ito	Member deleted: Naomi Ito	Cate Woolsey	\N	2026-03-19 12:42:48.418+00
9b15649f-2b3d-44e9-8c33-b516bfbcaec4	memberDeleted	Deleted member: Yuki Watanabe	Member deleted: Yuki Watanabe	Cate Woolsey	\N	2026-03-19 12:42:51.038+00
b49e6e57-fdee-4ac0-ae97-6d6f092ec534	memberDeleted	Deleted member: Hiroshi Sato	Member deleted: Hiroshi Sato	Cate Woolsey	\N	2026-03-19 12:42:52.932+00
ce8138dc-ac91-4c5f-9592-c4540e87e6ea	memberDeleted	Deleted member: Emi Nakamura	Member deleted: Emi Nakamura	Cate Woolsey	\N	2026-03-19 12:42:54.971+00
b3c98f36-2635-49ab-a476-55a2d1916c4a	memberDeleted	Deleted member: Kenji Tanaka	Member deleted: Kenji Tanaka	Cate Woolsey	\N	2026-03-19 12:42:56.58+00
7b44516e-0a0c-4f1a-9a1f-8ee5548e0443	memberDeleted	Deleted member: Takeshi Yamamoto	Member deleted: Takeshi Yamamoto	Cate Woolsey	\N	2026-03-19 12:42:58.476+00
17b9e97d-a4b0-4c69-a49d-0340c9d9119c	memberDeleted	Deleted member: Tony Min	Member deleted: Tony Min	Cate Woolsey	\N	2026-03-19 12:43:00.457+00
dd04aa7c-a00f-4d5c-8ee7-588b7fafc499	leaderEdited	Edited leader: Yoshi Yamada (山田 善久)	Edited leader: Yoshi Yamada (山田 善久)	Cate Woolsey	\N	2026-03-19 12:55:14.202+00
c8568c37-504e-4bdc-9d3e-2bae2486ead9	memberAdded	Added member: Inglewood, Inc. (株式会社イングルウッド)	Added member: Inglewood, Inc. (株式会社イングルウッド)	Cate Woolsey	\N	2026-03-19 13:03:17.197+00
5c694e67-2d0f-4367-92eb-a35b0492f4fa	memberEdited	Edited member: Inglewood, Inc.	Edited member: Inglewood, Inc.	Cate Woolsey	\N	2026-03-19 13:03:35.358+00
ee3bd58e-59f6-4209-b09a-6be629b123c7	memberAdded	Added member: Atsushi Mizushima	Added member: Atsushi Mizushima	Cate Woolsey	\N	2026-03-19 13:04:03.208+00
88772aa1-3565-42f0-9a7a-ea2ea55ffbe2	memberEdited	Edited member: Inglewood, Inc.	Edited member: Inglewood, Inc.	Cate Woolsey	\N	2026-03-19 13:04:17.238+00
3207d272-4ef6-4133-b458-3825c838f043	memberAdded	Added member: Daisuke Asahara	Added member: Daisuke Asahara	Cate Woolsey	\N	2026-03-19 13:04:58.245+00
61a99beb-e0fd-4ccf-bf5b-6a95006dc38b	memberAdded	Added member: Tatsuo Kawasaki	Added member: Tatsuo Kawasaki	Cate Woolsey	\N	2026-03-19 13:05:14.308+00
108b02c1-4c3a-45cc-9526-7db33891efef	memberAdded	Added member: Takashi Mitachi	Added member: Takashi Mitachi	Cate Woolsey	\N	2026-03-19 13:05:28.678+00
943b3387-44e1-4012-afc2-1475243d71a1	memberAdded	Added member: Ryutaro Nakata	Added member: Ryutaro Nakata	Cate Woolsey	\N	2026-03-19 13:05:49.939+00
bc698473-e872-473e-a610-d339a99c8b8e	memberAdded	Added member: Masato Miki	Added member: Masato Miki	Cate Woolsey	\N	2026-03-19 13:06:01.716+00
d0402d91-a8f1-4f29-96a7-465804cccf2d	memberAdded	Added member: Atsushi Egawa	Added member: Atsushi Egawa	Cate Woolsey	\N	2026-03-19 13:07:02.458+00
7afa860f-478f-4fac-aa85-0f9002dcde1e	authAccountCreated	Created auth account for: Inglewood, Inc.	Created auth account for: Inglewood, Inc.	Cate Woolsey	\N	2026-03-19 13:07:57.327+00
4296a6e3-814d-404d-8207-8d34542a051a	authAccountCreated	Created auth account for: Atsushi Mizushima	Created auth account for: Atsushi Mizushima	Cate Woolsey	\N	2026-03-19 13:08:16.705+00
afb5f09b-9da7-4d86-8da1-5190dc52be8f	authAccountCreated	Created auth account for: Daisuke Asahara	Created auth account for: Daisuke Asahara	Cate Woolsey	\N	2026-03-19 13:08:30.689+00
01f695f8-72e9-4101-94cb-8f67ec52c03e	authAccountCreated	Created auth account for: Tatsuo Kawasaki	Created auth account for: Tatsuo Kawasaki	Cate Woolsey	\N	2026-03-19 13:08:44.47+00
53d77362-2c07-4c21-b12d-09e4ddbd5dd5	authAccountCreated	Created auth account for: Takashi Mitachi	Created auth account for: Takashi Mitachi	Cate Woolsey	\N	2026-03-19 13:08:58.696+00
33a2eb2e-b40a-49c7-8dba-6e773f1962ce	authAccountCreated	Created auth account for: Ryutaro Nakata	Created auth account for: Ryutaro Nakata	Cate Woolsey	\N	2026-03-19 13:09:13.57+00
e6db34ea-ef14-45a9-9f4c-a548c03f01ac	authAccountCreated	Created auth account for: Masato Miki	Created auth account for: Masato Miki	Cate Woolsey	\N	2026-03-19 13:09:25.249+00
90362ce9-8cd4-450b-b810-538e107f5b62	authAccountCreated	Created auth account for: Atsushi Egawa	Created auth account for: Atsushi Egawa	Cate Woolsey	\N	2026-03-19 13:09:38.045+00
1f16729f-e6fe-48c9-9134-60e2b68e2fa5	leaderEdited	Edited leader: Yoshi Yamada	Edited leader: Yoshi Yamada	Cate Woolsey	\N	2026-03-19 13:11:25.477+00
d85f82d4-074c-4f87-bb61-a588592592b2	dealAdded	Added deal: Replit Inc	Added deal: Replit Inc	Cate Woolsey	\N	2026-04-01 12:36:30.014+00
3bbaf853-e3d3-4b9c-b92f-74f4f89e8c65	dealEdited	Edited deal: Replit Inc	Edited deal: Replit Inc	Cate Woolsey	\N	2026-04-01 12:37:26.791+00
27085f89-66d6-4ce8-a01b-c3e06166e778	dealEdited	Edited deal: Replit Inc	Edited deal: Replit Inc	Cate Woolsey	\N	2026-04-01 12:39:23.496+00
91e36d45-50c5-423b-93df-bf6fcb4dd5a7	dealEdited	Edited deal: Replit Inc	Edited deal: Replit Inc	Cate Woolsey	\N	2026-04-01 12:41:44.062+00
a00422b5-0ff8-4963-8e6b-c5c66a1c19db	dealEdited	Edited deal: Replit Inc	Edited deal: Replit Inc	Cate Woolsey	\N	2026-04-01 12:52:34.499+00
0eb7e452-2443-44d2-b58a-a4cd29dd315d	dealEdited	Edited deal: Wasabi	Edited deal: Wasabi	Cate Woolsey	\N	2026-04-01 13:14:02.552+00
ab0d0135-5ad1-4268-891a-d9bfee6cb163	dealEdited	Edited deal: Wasabi	Edited deal: Wasabi	Cate Woolsey	\N	2026-04-01 13:14:27.73+00
ffe84a0b-1346-4444-8ecf-41327d5f4cb7	dealEdited	Edited deal: Wasabi	Edited deal: Wasabi	Cate Woolsey	\N	2026-04-01 13:14:38.601+00
2835cb2b-7597-4626-a511-37ea7c433ed6	dealEdited	Edited deal: Wasabi	Edited deal: Wasabi	Cate Woolsey	\N	2026-04-01 13:21:03.232+00
5fdab6a1-5185-4378-9c34-664de59f6f77	dealEdited	Edited deal: Wasabi	Edited deal: Wasabi	Cate Woolsey	\N	2026-04-01 13:21:13.698+00
cb9d228a-affe-4d34-aeaa-dcd0f6625aa3	dealEdited	Edited deal: TRM Labs	Edited deal: TRM Labs	Cate Woolsey	\N	2026-04-01 13:23:43.539+00
ce8337f6-9477-4df1-aec2-e4a3dfe5a553	dealEdited	Edited deal: TRM Labs	Edited deal: TRM Labs	Cate Woolsey	\N	2026-04-01 13:24:47.458+00
028786f2-05ff-4b1d-b1d1-55b01e95d81e	dealEdited	Edited deal: TC Lab	Edited deal: TC Lab	Cate Woolsey	\N	2026-04-01 13:29:20.203+00
ccdfb139-bb01-48e5-86e0-8b4d3db366b1	dealEdited	Edited deal: TC Lab	Edited deal: TC Lab	Cate Woolsey	\N	2026-04-01 13:30:28.368+00
e5d98e70-37a9-4723-8727-c860a0fea34f	dealEdited	Edited deal: TC Lab	Edited deal: TC Lab	Cate Woolsey	\N	2026-04-01 13:31:18.917+00
79585722-3ab3-4d47-9398-6e43c13fb652	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-04-01 13:34:45.785+00
db96ac6a-cdfa-4b5d-a98e-36cf405b4b5a	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-04-01 13:35:18.371+00
7274a602-f4f3-41a1-990f-d05a9a4f9f83	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-04-01 13:36:21.834+00
31f62967-9726-4f81-aeb8-aa26684e0a2a	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-04-01 13:36:57.829+00
3d8c3068-c12b-48b3-b5fc-315ed53e3edd	dealEdited	Edited deal: Orion Security	Edited deal: Orion Security	Cate Woolsey	\N	2026-04-01 13:41:59.878+00
d7a7bfee-fdbc-4107-8330-6c810d964f69	dealEdited	Edited deal: Orion Security	Edited deal: Orion Security	Cate Woolsey	\N	2026-04-01 13:43:09.197+00
aadb3760-f543-46ae-bb7e-0f9d85db98b3	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-04-01 13:46:53.296+00
27794a06-6854-486a-8220-1f4391b49e8a	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-04-01 13:49:37.714+00
0a33f027-c552-4ecf-be46-1e41b1723158	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-04-01 13:49:43.586+00
efadab17-cd85-4637-b2e4-83be59f5e250	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-04-01 13:50:37.495+00
88fb6ef7-2c0d-4b42-8f7c-248a0327b6dd	dealEdited	Edited deal: General Intuition	Edited deal: General Intuition	Cate Woolsey	\N	2026-04-01 13:53:35.839+00
93468d2b-2993-435a-9114-b6ab2f6bb2b6	dealEdited	Edited deal: General Intuition	Edited deal: General Intuition	Cate Woolsey	\N	2026-04-01 13:54:42.302+00
655cccf6-3efc-49f3-9c80-a642c29724a0	dealEdited	Edited deal: Firestorm	Edited deal: Firestorm	Cate Woolsey	\N	2026-04-01 13:57:46.34+00
192bbecd-e05c-4bd0-97af-8788cedd85ba	dealEdited	Edited deal: Firestorm	Edited deal: Firestorm	Cate Woolsey	\N	2026-04-01 13:58:21.986+00
2ee67184-27f8-4c2e-8995-ce83c9d655db	eventDeleted	Deleted event: Kizuna Spring Dinner 2026	Deleted event: Kizuna Spring Dinner 2026	Cate Woolsey	\N	2026-04-01 14:56:03.214+00
5beec53a-cbcb-4460-8c4d-d9ba4a1dd861	eventDeleted	Deleted event: Kizuna Summer Networking	Deleted event: Kizuna Summer Networking	Cate Woolsey	\N	2026-04-01 14:56:05.348+00
fa09ac8a-19e9-4148-9cf2-236d2c54e7dc	eventDeleted	Deleted event: Kizuna Autumn Dinner 2026	Deleted event: Kizuna Autumn Dinner 2026	Cate Woolsey	\N	2026-04-01 14:56:07.869+00
804d7258-c74d-401e-bd69-8d5041fe9f8c	announcementCreated	Created announcement: test	Created announcement: test	Cate Woolsey	\N	2026-04-01 15:01:27.313+00
a719fd79-f100-4f2c-8c9a-65d9ad993649	announcementDeleted	Deleted announcement: test	Deleted announcement: test	Cate Woolsey	\N	2026-04-01 15:13:49.253+00
e123b365-5806-4e14-af3a-e80aaa95f85d	memberDeleted	Deleted member: Inglewood, Inc.	Member deleted: Inglewood, Inc.	Cate Woolsey	\N	2026-04-01 16:08:34.622+00
002a543e-d0b1-4029-808e-c047ae8a5f50	memberDeleted	Deleted member: Ryutaro Nakata	Member deleted: Ryutaro Nakata	Cate Woolsey	\N	2026-04-01 16:08:39.426+00
9b38577e-7e2c-4d2e-ba37-123b594bad7c	memberAdded	Added member: Eijiro Imai	Added member: Eijiro Imai	Cate Woolsey	\N	2026-04-10 15:24:11.862+00
5f6ce0f9-795a-4ed6-9f8f-f0fcfc836e7e	memberEdited	Edited member: Eijiro Imai	Edited member: Eijiro Imai	Cate Woolsey	\N	2026-04-10 15:25:16.261+00
f33b70b9-cda4-4a29-a90e-f3256d61f9f8	memberEdited	Edited member: Eijiro Imai	Edited member: Eijiro Imai	Cate Woolsey	\N	2026-04-10 15:25:47.863+00
82184f54-c4ed-40c3-a7a5-90470a27f298	authAccountCreated	Created auth account for: Eijiro Imai	Created auth account for: Eijiro Imai	Cate Woolsey	\N	2026-04-13 19:08:24.244+00
9921695d-f8f2-4bf3-9244-5277d5cea7b4	announcementCreated	Created announcement: test	Created announcement: test	Cate Woolsey	\N	2026-05-06 19:57:18.873+00
421f2fbd-559d-4ad6-83ad-53d8e05c9ece	announcementPinned	Pinned announcement: test	Pinned announcement: test	Cate Woolsey	\N	2026-05-06 19:57:26.327+00
fdf38dad-7e11-4255-a9d4-38332981a578	announcementPinned	Pinned announcement: Welcome to Kizuna Club	Pinned announcement: Welcome to Kizuna Club	Cate Woolsey	\N	2026-05-06 19:57:28.029+00
693ff9fb-5f23-4487-9538-6a3e8d22713b	announcementDeleted	Deleted announcement: test	Deleted announcement: test	Cate Woolsey	\N	2026-05-06 19:57:30.893+00
83614f42-bb3b-41d3-abdd-6ebcb248602d	discussionAdded	Added discussion: test	Added discussion: test	Cate Woolsey	\N	2026-05-06 20:07:05.12+00
c948b091-c83e-43f3-8ec4-2b031106defa	eventCreated	Created event: test	Created event: test	Cate Woolsey	\N	2026-05-06 20:07:20.045+00
36b31994-abd6-4833-8248-d04104eea4e8	emailSent	Reminder sent for: test to 11 members	Reminder sent for: test to 11 members	Cate Woolsey	\N	2026-05-06 20:12:54.599+00
cd8e4e7f-4931-4a1b-b1b9-c75b30a4099d	emailSent	Reminder sent for: test to 11 members	Reminder sent for: test to 11 members	Cate Woolsey	\N	2026-05-06 20:12:56.133+00
52d52f5b-f95b-490e-9345-784697278f2c	emailSent	Reminder sent for: test to 11 members	Reminder sent for: test to 11 members	Cate Woolsey	\N	2026-05-06 20:12:58.832+00
7e5b140d-4748-4867-ba4f-19d5ca73baea	discussionAdded	Added discussion: test2	Added discussion: test2	Cate Woolsey	\N	2026-05-06 20:16:06.24+00
2e4598fa-459b-48b5-8862-70d0222d8367	passwordReset	Reset password for: Yoshi Yamada	Reset password for: Yoshi Yamada	Cate Woolsey	\N	2026-05-06 21:30:42.307+00
9fd20eeb-29cd-4377-a061-f19cdeae2bd9	passwordReset	Reset password for: Yoshi Yamada	Reset password for: Yoshi Yamada	Cate Woolsey	\N	2026-05-06 21:31:14.037+00
317580dc-0a5b-47c5-ac18-8e1ed6ca169b	passwordReset	Reset password for: Yoshi Yamada	Reset password for: Yoshi Yamada	Cate Woolsey	\N	2026-05-06 21:31:48.386+00
3c54e429-3497-4458-ae38-eb7a13cc8fe4	leaderProfileHidden	Hid leader profile: Cate Woolsey	Hid leader profile: Cate Woolsey	Cate Woolsey	\N	2026-05-07 11:45:37.419+00
3583ac7b-5ad7-4076-93bd-65411bb285f9	leaderProfileHidden	Hid leader profile: Ayla Langer	Hid leader profile: Ayla Langer	Cate Woolsey	\N	2026-05-07 11:45:41.172+00
464d0437-2a0d-4eec-9329-d4f43860b0b0	leaderProfileHidden	Hid leader profile: Mike Collins	Hid leader profile: Mike Collins	Cate Woolsey	\N	2026-05-07 11:45:41.876+00
c5e668b1-49fa-41f4-89e4-7d8d2660a29e	leaderAdded	Added leader: Ludwig Schulze	Added leader: Ludwig Schulze	Cate Woolsey	\N	2026-05-07 11:46:49.515+00
ddc4a4b5-4047-499d-be83-a5f161c50c7e	leaderProfileShown	Showed leader profile: Mike Collins	Showed leader profile: Mike Collins	Cate Woolsey	\N	2026-05-07 11:47:42.556+00
1cc539eb-1846-4515-a9ce-25b0316d6746	leaderAdded	Added leader: MGP Phillips	Added leader: MGP Phillips	Cate Woolsey	\N	2026-05-07 11:50:29.894+00
004742cb-4499-491d-88f8-84080fc3014d	memberEdited	Edited member: Atsushi Mizushima	Edited member: Atsushi Mizushima	Cate Woolsey	\N	2026-05-07 11:52:54.539+00
b0663388-e65d-4896-98ea-109721b0f0aa	memberEdited	Edited member: Atsushi Mizushima	Edited member: Atsushi Mizushima	Cate Woolsey	\N	2026-05-07 11:53:17.41+00
d4752969-e405-4b79-bed3-979adc5f552d	leaderEdited	Edited leader: Mike Collins	Edited leader: Mike Collins	Cate Woolsey	\N	2026-05-07 11:55:15.565+00
c340ccb3-e2e6-4896-8e02-44767e5fe0c7	leaderEdited	Edited leader: Ludwig Schulze	Edited leader: Ludwig Schulze	Cate Woolsey	\N	2026-05-07 11:57:08.618+00
d97a1035-6a4d-4cc6-a1c1-48a86210d758	leaderEdited	Edited leader: Michael Phillips	Edited leader: Michael Phillips	Cate Woolsey	\N	2026-05-07 11:57:36.805+00
f934f4a3-0a92-4ef4-8dcd-b4111cca7a9e	discussionDeleted	Deleted discussion: test	Deleted discussion: test	Cate Woolsey	\N	2026-05-07 12:05:31.679+00
d2cd1abe-9c9e-4acc-b210-6106dedb3cf9	discussionAdded	Added discussion: test	Added discussion: test	Cate Woolsey	\N	2026-05-07 12:26:47.848+00
a5c72160-eae4-4553-af36-85b9e4fe53b6	discussionDeleted	Deleted discussion: test	Deleted discussion: test	Cate Woolsey	\N	2026-05-07 12:27:02.249+00
c333d127-1f78-4864-8f22-7f5613df100e	dealEdited	Edited deal: Replit Inc	Edited deal: Replit Inc	Cate Woolsey	\N	2026-05-07 13:03:44.576+00
77c52057-7e6a-478c-b9fc-4a491757500a	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-05-07 13:05:21.279+00
6ad48ad3-cea8-4bbc-93ca-c41921ffc116	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-05-07 13:07:16.015+00
4d53ec24-9ae8-49d9-9eb6-02725f120a29	dealEdited	Edited deal: Replit Inc	Edited deal: Replit Inc	Cate Woolsey	\N	2026-05-07 13:07:58.64+00
ce16512a-643b-4a0c-b371-aaa47932d5b4	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-05-07 13:09:00.311+00
6393ff7e-367f-4c98-910c-32d3b6aced37	dealEdited	Edited deal: Replit Inc	Edited deal: Replit Inc	Cate Woolsey	\N	2026-05-07 13:10:42.511+00
8fe810c7-77ce-4877-8526-de86485bafc7	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-05-07 13:19:04.552+00
42dfbc70-0f09-4094-a99d-b13834b2580c	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-05-07 13:20:08.661+00
1657233b-174f-4bb7-ac50-53f4878b6b26	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-05-07 13:25:26.054+00
da8ca9cb-5fac-4754-bdb6-218ab5bf3825	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-05-07 13:27:08.181+00
9dda9b25-5f7e-490f-aa7b-617b2e2b43b5	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-05-07 13:29:16.386+00
98fce699-7192-4bef-94ef-e5d0db6aa9f9	dealEdited	Edited deal: Replit Inc	Edited deal: Replit Inc	Cate Woolsey	\N	2026-05-07 13:30:13.318+00
06935dde-3dbb-471e-b1e5-a3906e864789	dealEdited	Edited deal: Lambda	Edited deal: Lambda	Cate Woolsey	\N	2026-05-07 13:30:17.726+00
46b3d1d3-8048-4c38-9e99-151506639c9e	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-05-07 13:30:22.095+00
f52431dd-9fce-4514-8ed5-ed6b2a27df6d	dealReordered	Reordered: Lambda	並べ替え: Lambda	Cate Woolsey	\N	2026-05-07 13:44:57.384+00
23aa4bcc-aeaa-4772-8c60-af3d2d94a5d4	dealReordered	Reordered: Lambda	並べ替え: Lambda	Cate Woolsey	\N	2026-05-07 13:46:39.284+00
df627266-3f04-4f94-9f54-51235d385d4c	dealEdited	Edited deal: Orion Security	Edited deal: Orion Security	Cate Woolsey	\N	2026-05-07 13:49:45.901+00
10a9bba2-961d-472d-895a-843c30b9216e	dealEdited	Edited deal: Orion Security	Edited deal: Orion Security	Cate Woolsey	\N	2026-05-07 13:49:52.56+00
6d12bd49-cf74-455e-b13d-bca85fb81b02	dealEdited	Edited deal: Orion Security	Edited deal: Orion Security	Cate Woolsey	\N	2026-05-07 13:59:00.846+00
8eebeaa5-d600-41f2-8d17-fdfee5924ec9	dealEdited	Edited deal: Firestorm	Edited deal: Firestorm	Cate Woolsey	\N	2026-05-07 14:05:24.331+00
8eee1fdb-604b-4c18-993d-3ad5ef975c27	dealEdited	Edited deal: TRM Labs	Edited deal: TRM Labs	Cate Woolsey	\N	2026-05-07 14:09:41.12+00
3c0543aa-24a2-4f6e-a4b1-1bc121a76ed8	dealEdited	Edited deal: TRM Labs	Edited deal: TRM Labs	Cate Woolsey	\N	2026-05-07 14:11:25.079+00
abead2fb-f6d0-41ce-936b-be9dfce35a9c	dealEdited	Edited deal: Wasabi	Edited deal: Wasabi	Cate Woolsey	\N	2026-05-07 14:18:32.894+00
d7080fa7-c1f9-4bfc-a8d9-ee68e24f2ac4	dealEdited	Edited deal: Orion Security	Edited deal: Orion Security	Cate Woolsey	\N	2026-05-07 14:20:22.121+00
473c425a-4b75-49e4-9f58-38d2479baf5a	dealEdited	Edited deal: Wasabi	Edited deal: Wasabi	Cate Woolsey	\N	2026-05-07 14:24:19.853+00
0e99f3ab-122a-4bda-af17-65295186df7e	dealEdited	Edited deal: TC Lab	Edited deal: TC Lab	Cate Woolsey	\N	2026-05-07 14:28:02.706+00
95ae1e56-a2f5-4dcd-923c-d21d83a1d631	dealEdited	Edited deal: Reflect Orbital	Edited deal: Reflect Orbital	Cate Woolsey	\N	2026-05-07 14:28:18.137+00
3a81e1dd-1310-44bf-a1ec-2bf260d30556	dealEdited	Edited deal: TC Lab	Edited deal: TC Lab	Cate Woolsey	\N	2026-05-07 14:29:10.903+00
d18c4069-525e-475a-a6a6-675cbd73e90b	dealEdited	Edited deal: TC Lab	Edited deal: TC Lab	Cate Woolsey	\N	2026-05-07 14:29:40.356+00
cb45377c-84e1-4913-8889-815feba04d52	dealEdited	Edited deal: General Intuition	Edited deal: General Intuition	Cate Woolsey	\N	2026-05-07 14:33:14.654+00
1171cbec-09bc-4434-9898-2d347e98ed50	dealEdited	Edited deal: General Intuition	Edited deal: General Intuition	Cate Woolsey	\N	2026-05-07 14:33:58.873+00
a3795dba-a1b4-4a9f-b5ad-890a5cfe1fd0	eventDeleted	Deleted event: test	Deleted event: test	Cate Woolsey	\N	2026-05-07 14:43:59.19+00
6aa5f8c3-e935-4ce3-b3c7-3697d507b1eb	authAccountCreated	Created auth account for: Ludwig Schulze	Created auth account for: Ludwig Schulze	Cate Woolsey	\N	2026-05-07 14:45:08.101+00
d021da38-fb76-4fb7-ab11-2b2eed20a319	authAccountCreated	Created auth account for: Michael Phillips	Created auth account for: Michael Phillips	Cate Woolsey	\N	2026-05-07 14:46:15.442+00
384a2f97-78eb-4041-9dfa-e2f79ad3753a	eventCreated	Created event: test	Created event: test	Cate Woolsey	\N	2026-05-07 14:54:51.966+00
b5f1d5dd-bb7d-491c-a0f0-94291c5976b4	discussionAdded	Added discussion: test	Added discussion: test	Cate Woolsey	\N	2026-05-07 14:54:58.132+00
765348f0-e397-46b2-bda2-1bccde56863a	eventDeleted	Deleted event: test	Deleted event: test	Cate Woolsey	\N	2026-05-07 14:55:08.73+00
c80193d4-e0be-4bd1-87f9-786173999dca	discussionDeleted	Deleted discussion: test	Deleted discussion: test	Cate Woolsey	\N	2026-05-07 14:55:10.25+00
7e629536-f48a-47b6-85bf-d2df406791b2	eventCreated	Created event: Dinner (November)	Created event: Dinner (November)	Cate Woolsey	\N	2026-05-07 14:56:54.394+00
5af24b59-f76d-4ac7-a8de-9a1dfd099c90	eventDeleted	Deleted event: Dinner (November)	Deleted event: Dinner (November)	Cate Woolsey	\N	2026-05-07 20:39:08.835+00
96e72482-e4d0-4fa2-9ec4-ace448f67e41	eventCreated	Created event: Dinner (November)	Created event: Dinner (November)	Cate Woolsey	\N	2026-05-07 20:42:31.753+00
32108dbe-9585-4735-82e3-967ccf70d20a	leaderShownInMembersRow	Yoshi Yamada now displayed in Members row	Yoshi Yamada now displayed in Members row	Cate Woolsey	\N	2026-05-07 20:46:46+00
3e576c71-2955-4bf8-bac7-47f9cce796f2	leaderShownInMembersRow	Ryan Nakata now displayed in Members row	Ryan Nakata now displayed in Members row	Cate Woolsey	\N	2026-05-07 20:46:49.512+00
997b4448-c63e-4c13-b2d9-4f60cb34de4f	passwordReset	Reset password for: Atsushi Mizushima	Reset password for: Atsushi Mizushima	Cate Woolsey	\N	2026-06-02 13:47:36.916+00
3b505dac-b32a-4df0-8487-930a9601bd43	passwordReset	Reset password for: Atsushi Mizushima	Reset password for: Atsushi Mizushima	Cate Woolsey	\N	2026-06-02 13:49:05.002+00
0e564c25-df90-4d51-942d-f4d53976fe00	passwordReset	Reset password for: Atsushi Mizushima	Reset password for: Atsushi Mizushima	Cate Woolsey	\N	2026-06-02 13:50:48.621+00
ca765e74-08aa-444d-ab7a-4efd7139ac88	passwordReset	Reset password for: Atsushi Mizushima	Reset password for: Atsushi Mizushima	Cate Woolsey	\N	2026-06-02 13:59:59.403+00
21eb876a-dfb4-43d4-b06b-7f47f05bcf04	memberAdded	Added member: Nami Hamada	Added member: Nami Hamada	Cate Woolsey	\N	2026-06-15 19:44:39.733+00
a4050464-8dc5-4a0f-ada4-852c0bf8e083	authAccountCreated	Created auth account for: Nami Hamada	Created auth account for: Nami Hamada	Cate Woolsey	\N	2026-06-15 19:46:52.389+00
8f9cd2f7-1869-4df6-a705-01ec1d92a39b	memberAdded	Added member: Izumi Nishiaki	Added member: Izumi Nishiaki	Cate Woolsey	\N	2026-06-15 19:48:10.919+00
0de60c39-5bb1-476a-a04e-5e9e84fd45ec	authAccountCreated	Created auth account for: Izumi Nishiaki	Created auth account for: Izumi Nishiaki	Cate Woolsey	\N	2026-06-15 19:48:17.232+00
14cb0049-382d-421a-9440-4cd21f3b687b	passwordReset	Reset password for: Nami Hamada	Reset password for: Nami Hamada	Cate Woolsey	\N	2026-06-15 19:59:30.287+00
bac905d4-613e-4fbe-bc49-4c16bb06d62c	passwordReset	Reset password for: Izumi Nishiaki	Reset password for: Izumi Nishiaki	Cate Woolsey	\N	2026-06-15 19:59:46.778+00
81e0f1e0-39c4-4c91-a4d9-5570c576c9cb	dealAdded	Added deal: Lila Sciences	Added deal: Lila Sciences	Cate Woolsey	\N	2026-06-17 18:01:57.243+00
4a8bc603-fd58-4c0c-b365-0bf4412711ed	dealEdited	Edited deal: Lila Sciences	Edited deal: Lila Sciences	Cate Woolsey	\N	2026-06-17 18:04:38.77+00
929abd87-9a9c-4c9e-bb3d-b9180dd79473	dealEdited	Edited deal: Lila Sciences	Edited deal: Lila Sciences	Cate Woolsey	\N	2026-06-17 18:04:48.311+00
4b12a988-7158-4931-bbaa-45bbd61f643b	dealEdited	Edited deal: Lila Sciences	Edited deal: Lila Sciences	Cate Woolsey	\N	2026-06-17 18:07:33.031+00
33edaee9-b91f-4caa-a939-bb89182a8628	dealEdited	Edited deal: Lila Sciences	Edited deal: Lila Sciences	Cate Woolsey	\N	2026-06-17 18:22:32.729+00
b1c494fe-0a0b-4b6b-b7c2-a83c7c9e7cea	dealAdded	Added deal: Yaqumo	Added deal: Yaqumo	Cate Woolsey	\N	2026-06-24 19:22:34.576+00
6146c2fd-7c8c-40ea-a2ad-668026bce485	dealEdited	Edited deal: Yaqumo	Edited deal: Yaqumo	Cate Woolsey	\N	2026-06-24 19:29:42.381+00
dd5f3298-83ab-45e1-b061-0915eabbea59	dealEdited	Edited deal: Yaqumo	Edited deal: Yaqumo	Cate Woolsey	\N	2026-06-24 21:27:40.995+00
f090fdaa-3217-4285-a8aa-b35089d6d074	dealEdited	Edited deal: Yaqumo	Edited deal: Yaqumo	Cate Woolsey	\N	2026-06-24 21:29:04.08+00
c619ae61-6186-4d83-87d5-85fae4e7e1b1	dealAdded	Added deal: Noda AI	Added deal: Noda AI	Cate Woolsey	\N	2026-07-13 12:03:41.617+00
a2224105-b5c1-4fbb-adfc-439b2517138f	dealEdited	Edited deal: Noda AI	Edited deal: Noda AI	Cate Woolsey	\N	2026-07-13 12:24:32.509+00
332a28b3-683a-4184-839b-0a531c5f0a8c	dealEdited	Edited deal: Noda AI	Edited deal: Noda AI	Cate Woolsey	\N	2026-07-13 14:12:05.423+00
f613a6c9-b254-44ac-9ca3-952617204421	dealAdded	Added deal: Core Automation	Added deal: Core Automation	Cate Woolsey	\N	2026-07-16 11:48:40.646+00
b86e3857-b09c-4e8a-b8ae-e5d3b91fd5f9	dealEdited	Edited deal: Core Automation	Edited deal: Core Automation	Cate Woolsey	\N	2026-07-16 11:49:10.883+00
6c46dff8-f83c-4f97-96b0-60829587e41f	dealAdded	Added deal: Lila Sciences	Added deal: Lila Sciences	Cate Woolsey	\N	2026-07-16 11:52:41.682+00
17d176ce-17a3-4284-830d-91870d813d73	dealEdited	Edited deal: Lila Sciences	Edited deal: Lila Sciences	Cate Woolsey	\N	2026-07-16 11:53:02.791+00
b436ab08-3733-4487-9ee3-bdf37a701129	dealAdded	Added deal: RegCell Bio	Added deal: RegCell Bio	Cate Woolsey	\N	2026-07-16 11:57:58.907+00
\.


--
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.announcements (id, title, title_ja, content, content_ja, author, status, pinned, scheduled_date, created_at) FROM stdin;
04350dc3-f70c-4d48-bb32-73aada34b502	Welcome to Kizuna Club		Alumni Ventures is excited to launch the Kizuna Club platform.		Admin	published	t	\N	2026-01-22 14:12:30.328536+00
\.


--
-- Data for Name: archived_deals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.archived_deals (id, original_id, deal_type, name, name_ja, sector, stage, data, archived_at, archived_by) FROM stdin;
\.


--
-- Data for Name: co_investors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.co_investors (id, name, name_ja, firm, firm_ja, bio, bio_ja, notable_investments, connection_strength, emoji, coinvests_with, created_at) FROM stdin;
\.


--
-- Data for Name: deal_interests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deal_interests (id, deal_id, deal_name, member_id, member_name, member_email, interest_type, message, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: dinners; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dinners (id, title, title_ja, date, "time", venue, venue_ja, capacity, attendees, not_attending, not_responded, is_upcoming, created_at, end_date) FROM stdin;
d3a3103a-eb02-46e6-ba3d-ff275de55626	Dinner (November)	\N	2026-11-06	18:30	TBD	\N	14	{a752c81a-630e-4235-8802-2e029c718535}	{}	{a2c3e913-9080-43be-b67e-5826d8262a1a,e349e771-72d0-4208-8700-96a046737e6c,1a854389-1ab0-487f-967c-28687c7e8246,47403f8b-149e-4fd9-911f-cb04da6e7cc4,73782cf1-993d-49d0-9c0e-403816e0bdd4,c56565a9-54f9-4a36-8f3b-3ef9fec75921,fdcd687b-73a2-4489-8e22-40e6b830b1d3,fefee279-46df-4630-9423-189265cc63c6,00d49849-f63d-497e-9a4c-5e92196d9f72,df2d3e96-feec-4d2c-8e4a-5d7553da5ebb,c4e57eb1-d659-48b3-95b2-12a848d7d00c,375bdfd9-7585-4111-9bee-fb3f473e4630,a4cb8c8a-f5c4-4aa0-91f5-8d9348848fdc}	t	2026-05-07 20:42:31.761214+00	2026-11-22
\.


--
-- Data for Name: discussions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.discussions (id, title, title_ja, description, description_ja, date, "time", timezone, host, topic, topic_ja, zoom_link, is_upcoming, rsvp_yes, rsvp_no, not_responded, created_at, meeting_url, end_date) FROM stdin;
a4de373c-c8b4-4257-bb3b-cc723ebba1a1	Japan FinTech Landscape	日本のフィンテック情勢	Overview of FinTech opportunities in Japan market.	日本市場におけるフィンテックの機会に関する概要。	2026-04-01	05:00	JST	Ryan Nakata	FinTech	フィンテック	\N	t	{efc27116-e96b-4f6e-a754-0c21eeb7c0b3}	{}	{897448e1-c7f9-467a-84d1-78b8f3699084,a8f1a018-f81d-4504-b7d7-5b9458b89293,83aeff1a-2b57-478a-bc23-1b878c08bb6a,63884eb2-3016-47b6-ba46-463b4bf77fd6,5fb6bd4d-fa76-4209-9e3b-f763563b2b48,508b729f-7b92-44bc-a04e-2bd2a5dc2114,0f0fa57b-9fb5-48ca-a963-15447178caec,a0567532-f889-426c-af93-671a307eae00,790c5c02-5931-4d19-9f1c-1fc0439b1efb,d4b5cb83-9b97-4170-8ed9-3b90af244583,571efcbd-4255-43dd-93ee-5488e689b857,f502ab65-16bc-47df-a615-a5aec9a886dd,6436710f-783b-40ca-8db7-8cc7ec684ba9}	2026-01-16 16:47:02.238634+00		\N
b9576b6c-6887-4f54-a1c7-9ccf79efdfed	Deep Dive: Quantum Computing	徹底解説：量子コンピューティング	Understanding quantum computing investments and timeline.	量子コンピューティングへの投資とタイムラインを理解する。	2026-03-04	19:00	JST	Yoshi Yamada	Quantum	量子	\N	t	{}	{a2c3e913-9080-43be-b67e-5826d8262a1a}	{897448e1-c7f9-467a-84d1-78b8f3699084,a8f1a018-f81d-4504-b7d7-5b9458b89293,83aeff1a-2b57-478a-bc23-1b878c08bb6a,63884eb2-3016-47b6-ba46-463b4bf77fd6,5fb6bd4d-fa76-4209-9e3b-f763563b2b48,508b729f-7b92-44bc-a04e-2bd2a5dc2114,0f0fa57b-9fb5-48ca-a963-15447178caec,a0567532-f889-426c-af93-671a307eae00,790c5c02-5931-4d19-9f1c-1fc0439b1efb,d4b5cb83-9b97-4170-8ed9-3b90af244583,571efcbd-4255-43dd-93ee-5488e689b857,f502ab65-16bc-47df-a615-a5aec9a886dd,6436710f-783b-40ca-8db7-8cc7ec684ba9}	2026-01-16 16:40:10.844012+00		\N
43a27161-5f0b-4040-9be7-20a9f315d374	AI Investment Thesis for 2026	2026年AI投資テーゼ	Deep dive into AI investment opportunities for the coming year.	来年におけるAI投資機会について徹底的に掘り下げて分析します。	2026-02-11	05:00	JST	Mike Collins	AI	AI	\N	t	{3d78687f-884a-4234-8de9-1181add7a033}	{95d67fc8-bb22-4a55-be22-2fbf4938f137,efc27116-e96b-4f6e-a754-0c21eeb7c0b3,a2c3e913-9080-43be-b67e-5826d8262a1a}	{897448e1-c7f9-467a-84d1-78b8f3699084,a8f1a018-f81d-4504-b7d7-5b9458b89293,83aeff1a-2b57-478a-bc23-1b878c08bb6a,63884eb2-3016-47b6-ba46-463b4bf77fd6,5fb6bd4d-fa76-4209-9e3b-f763563b2b48,508b729f-7b92-44bc-a04e-2bd2a5dc2114,0f0fa57b-9fb5-48ca-a963-15447178caec,a0567532-f889-426c-af93-671a307eae00,790c5c02-5931-4d19-9f1c-1fc0439b1efb,d4b5cb83-9b97-4170-8ed9-3b90af244583,571efcbd-4255-43dd-93ee-5488e689b857,f502ab65-16bc-47df-a615-a5aec9a886dd,6436710f-783b-40ca-8db7-8cc7ec684ba9}	2026-01-16 16:38:32.828068+00		\N
2d71d4d4-d960-4867-a9be-f4b05ddbf26a	test2	\N	test2	\N	2026-05-07	19:00	JST	Mike Collins	test2	\N	\N	t	{a2c3e913-9080-43be-b67e-5826d8262a1a}	{}	{e349e771-72d0-4208-8700-96a046737e6c,1a854389-1ab0-487f-967c-28687c7e8246,47403f8b-149e-4fd9-911f-cb04da6e7cc4,73782cf1-993d-49d0-9c0e-403816e0bdd4,a752c81a-630e-4235-8802-2e029c718535,fefee279-46df-4630-9423-189265cc63c6,00d49849-f63d-497e-9a4c-5e92196d9f72,df2d3e96-feec-4d2c-8e4a-5d7553da5ebb,c4e57eb1-d659-48b3-95b2-12a848d7d00c,375bdfd9-7585-4111-9bee-fb3f473e4630,a4cb8c8a-f5c4-4aa0-91f5-8d9348848fdc}	2026-05-06 20:16:06.223352+00	https://www.av.vc/	\N
\.


--
-- Data for Name: fund_holdings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fund_holdings (id, name, name_ja, sector, sector_ja, stage, description, description_ja, valuation, logo, co_investors, dd_complete, dd_reports, created_at, sort_order, meeting_url, year_established, city, country, is_pre_money, check_size, memo_url, deck_url, additional_media, valuation_approximate) FROM stdin;
9bd8a35f-3a75-4655-a7c8-d6b97a7b1ee4	Lila Sciences	\N	AI	\N	Series B	Lila Sciences is building the platform for Scientific Superintelligence: an AI reasoning model designed to generate scientific ideas, test them in real labs, learn from the results, and get smarter over time. The problem it is solving is straightforward: today's leading AI labs and foundation models are trained on the same broad substrate of human digital knowledge – roughly 15T tokens of text, papers, and existing human digital output – which means no one has a durable edge. Lila is taking a different path. It has already built roughly 10T tokens of proprietary scientific reasoning data and a system that continuously generates more through real-world experimentation. It is not applying more compute to the same data as everyone else. It is breaking through the first real scaling law for science: a foundational model paired with autonomous physical AI Science Factories that continuously generate new, high-quality scientific data of their own – compounding the platform's intelligence with every experiment run.	\N	8500000000	9bd8a35f-3a75-4655-a7c8-d6b97a7b1ee4_1781719316976.jpeg	{"CalPERS / Engine Ventures","NVentures / NVIDIA (anchor)","Collective Global","March Capital",MGX,"Prime Movers Lab","Ontario Teachers","Tiger Global","Thermo Fisher Scientific",Braidwell,"Craft Ventures",Amazon,"Others (Danaher",Airbus,Mitsubishi,"AE Industrials",OMERS)}	f	[]	2026-06-17 18:01:55.844628+00	0	\N	2023	Cambridge	MA	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1781719538077_lt9tqf1t8.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1781719576828_cg3daspkz.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1781719649030-veqwn.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1781719641368-cyzg4.pdf", "title": "Financial Projections"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1781719632044-82rwj.pdf", "title": "Offering Documents"}]	t
0b8e0a10-71f7-479b-8d4b-05031ab7b073	RegCell Bio	\N	Pharma / Biotech	\N	Series A	RegCell, co-founded by 2025 Nobel Laureate Shimon Sakaguchi, is a cell therapy company that retrains a patient’s own immune cells to stop attacking healthy tissue.\n\nRegCell’s platform goes beyond historical challenges in cell therapy. It takes a patient’s own disease-driving T cells and uses a small-molecule cocktail to epigenetically reprogram them into stable, suppressive Tregs. Because the original receptor is preserved, a single product can target multiple unknown disease drivers at once. Because no virus or gene editing is used, manufacturing is meaningfully simpler than CAR-Treg or gene-edited Treg approaches. \n\nThe lead asset targets autoimmune hepatitis, a chronic and fatal liver disease with no approved drugs. The company is entering a Phase 1b/2a study in Q4 2026, as soon as they obtain FDA green light (IND approval). They have four clinical sites in the US ready to start testing. Second application of the platform is in Inflammatory Bowel Disorders, and they plan to start those studies as early as 2027. \n\nThe company has secured >$70M of non-dilutive grant funding from the Japanese government (AMED program) through 2031 to support the two separate clinical indications. The Series A is $40M led by new investor Playground Global ($20M largest ever check) at $45M pre-money. The round funds the company with 36 months of runway through both Phase 1 and Phase 2 autoimmune hepatitis readouts and into H1 2029 with modest contingency.	\N	45000000	0b8e0a10-71f7-479b-8d4b-05031ab7b073_1784203078572.png	{"Playground Global","The University of Tokyo Edge Capital Partners","Fast Tack Initiative","Celadon Partners","Mitsubishi UFJ Capital","Osaka University Venture Capital","Kyoto University Innovation Capital"}	f	[]	2026-07-16 11:57:58.571642+00	0	\N	2016	Emeryville	USA	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1784203032564_e5fp5bfw8.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1784203037712_3jvotcoke.pdf	[]	f
8ce83997-ee06-4633-9950-211dcd38131d	Firestorm	\N	Supply Chain & Advanced Manufacturing	\N	Series B	Firestorm is building the infrastructure layer for next-generation defense manufacturing and autonomy, targeting a segment of the $850 billion U.S. defense budget increasingly focused on attritable systems, additive manufacturing, and contested logistics.\n\nThe company develops and deploys xCell, a mobile, high-throughput additive manufacturing system that produces unmanned systems and spare parts directly at the tactical edge. These systems are now fielded, producing Group 1 and Group 2 drones as well as validated parts for artillery, armored vehicles, and aircraft, with each unit capable of manufacturing up to 1,000 airframes per month and certified for global deployment. \n\nThe company has secured approximately $200 million in contracts, including a $100 million Air Force IDIQ and major awards through APFIT and STRATFI. Its $2.4 billion pipeline spans all major U.S. services, NATO, and Indo-Pacific buyers. Firestorm is raising a $75M Series B led by Washington Harbour Partners ($25M) at a $550M pre-money valuation. 	\N	550000000	8ce83997-ee06-4633-9950-211dcd38131d_1769105540279.png	{"Washington Harbour",NEA,"MVP Ventures","Alpen Ventures","Alexandria Ventures","Crumpton Ventures",In-Q-Tel}	f	[]	2026-01-22 18:12:20.255117+00	0	\N	2022	San Diego	USA	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775051899160_xzx7t0ymj.pdf	\N	[]	f
641c9c5f-b941-4007-b541-3c57456fcf18	TRM Labs	\N	Cryptocurrency / Blockchain	\N	Series C	TRM Labs is the leading AI-first blockchain crime intelligence platform securing the $4T crypto economy. Trusted by over 520 customers across public and private sectors, TRM helps financial institutions, crypto businesses, and government agencies detect, investigate, and prevent crypto-related fraud and financial crime. \n\nIts product powers AML monitoring, sanction screening, and forensic tracing, giving institutions the visibility and control needed to operate safely in digital assets.\n\nSince launching in 2019, TRM has reached $66M ARR and sustained a 185% CAGR, reflecting accelerating market adoption and the critical need for compliance and investigative infrastructure in crypto.\n\nBuilding on this foundation, TRM launched Orion, an AI operating system for blockchain crime investigations. Initially developed in-house, Orion uses TRM’s proprietary intelligence dataset to automate tracing, surface hidden connections, and guide analysts through complex cases in real time. The product represents a step-change from compliance to decision intelligence, expanding TRM’s market opportunity, deepening customer reliance, and positioning the company as the definitive intelligence layer for the crypto economy	\N	1000000000	641c9c5f-b941-4007-b541-3c57456fcf18_1769101775534.png	{"Blockchain Capital","Goldman Sachs",Galaxy,"Existing Investors: Thoma Bravo & Bessemer"}	f	[]	2026-01-21 20:03:16.673903+00	0	\N	2018	San Fracisco	USA	f	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775049848678_rg6646bue.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1775049854001_4r14q1owp.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775049863944-kykp7c.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775049871152-n400w.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775049883889-mr1ysj.pdf", "title": "Financial Projections"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778162976095-fr10vo.pdf", "title": "Offering Documents"}]	f
31bafa4d-9ee2-4a5f-8e50-7880683b4a84	Reflect Orbital	\N	Space / ClimateTech	\N	Series A+	Reflect Orbital is a bold new entrant at the frontier of climate and space infrastructure, building what may be the first commercially viable system for delivering sunlight from space. Founded in 2021 by aerospace engineer Ben Nowack, Reflect is creating a platform to beam solar energy directly to Earth using satellite constellations outfitted with steerable, very high‐precision mirrors. The company’s vision is nothing short of revolutionary: to transform sunlight into an on‐demand, programmable infrastructure service, redefining the way energy, light, and thermal resources are distributed across the planet. This is not science fiction – Reflect has two confirmed launches booked with SpaceX in July and October 2026. \n\nJust like Airbnb and Uber redefined their industries by inventing new market categories, Reflect is pioneering an entirely new class of programmable, orbital infrastructure. By enabling access to targeted, scheduled sunlight anywhere on Earth, at any hour, Reflect is not just extending the grid or enhancing solar; it’s unlocking a new orbital utility layer that merges space infrastructure with climate resilience, public lighting, and next-generation energy systems.	\N	300000000	31bafa4d-9ee2-4a5f-8e50-7880683b4a84.png	{"Sequoia Capital","Lux Capital","Starship Ventures","Buckley Ventures"}	f	[]	2026-01-22 14:39:18.766419+00	0	\N	2021	Los Angeles	USA	f	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775050541712_wfwv5eymo.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1775050547616_kvwqb4j3n.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775050551633-h0goea.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775050567695-ooo4oa.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775050558262-p3wi9v.pdf", "title": "Financial Projections"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778160320516-2o2i.pdf", "title": "Offering Documents"}]	f
74350664-772a-4ddc-bbc3-e8564c493075	TC Lab	\N	AI / ML	\N	Seed	TC Lab is disrupting the high-performance AI memory oligopoly of SK Hynix, Samsung, and Micron by building a novel memory technology with 10x the bit density, one-fifth the power consumption, and half the cost of today’s High Bandwidth Memory (“HBM”) and DRAM – a market that is expected to more than double by 2030 to $270 billion. Crucially, this technology is manufactured by repurposing the existing, lower-cost US fabs, allowing TC Lab to offer its memory at roughly half the price of next-gen HBM4 while still targeting 85% gross margins. At a time when essentially all advanced memory chips are produced in the Asian Pacific – even for US-headquartered Micron – reshoring production is a strategic priority for the US. TC Lab’s value proposition has already earned the company engagements with two hyperscalers and a leading AI Lab, who are in discussion to\nprovide the company $20 million in H1 2026 to prove out its technology in exchange for first access to production-grade chips, and could represent over $3 billion of revenue by 2030.	\N	56000000	74350664-772a-4ddc-bbc3-e8564c493075_1769108052666.png	{"Primary Venture Partners","Hyperion Capital","B Capital","Other Angels"}	f	[]	2026-01-22 18:54:12.650191+00	0	\N	\N	San Francisco	USA	f	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775050244428_1no2h5c89.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1775050248430_y7rz3jdlc.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775050266888-czlamr.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775050274354-0i2bzj.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778164145718-s3bori.pdf", "title": "Offering Documents"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775050255078-tr98mk.pdf", "title": "Financial Projections"}]	f
5835e32a-14b0-430c-a3b9-8aa4608d06e0	Yaqumo	\N	Quantum	\N	Seed extension round	Yaqumo is a Japan-based quantum computing company building the next generation of highly scalable and reliable quantum computers. Founded in 2025 and emerging from leading research programs at Kyoto University and the Institute for Molecular Science, the company is developing a novel hardware architecture designed to overcome some of the biggest barriers preventing quantum computers from reaching commercial scale. Yaqumo's mission is to make fault-tolerant quantum computing practical, enabling future breakthroughs in areas such as drug discovery, advanced materials, optimization, and scientific research. Backed by strong academic partnerships and significant Japanese government support, the company aims to become a leading provider of quantum computing infrastructure for research institutions, governments, and enterprises worldwide.	\N	150000000	5835e32a-14b0-430c-a3b9-8aa4608d06e0_1782328954328.png	{"Three existing investors from the previous round are not participating in this extension round. BNV","Kyoto iCAP (led previous round)",ANRI}	f	[]	2026-06-24 19:22:34.299866+00	0	\N	2025	Tokyo	Japan	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1782329335153_nbpo6hwgk.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1782328856907_vi6eao1th.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1782329376747-5tpvux.pdf", "title": "Technology Information & Roadmap DD"}]	f
fffac1b9-1762-4e5b-ab60-da92486a17bb	Noda AI	\N	Defense Tech; Data Infrastructure	\N	Series A	Noda Intelligence is developing the software “brain” for autonomous warfare: a battle management AI that enables fleets of unmanned systems to dynamically coordinate, adapt, and execute missions in contested, denied, and degraded environments.\n\nWhile many defense startups build hardware (drones, vehicles, sensors), Noda builds the orchestration layer above. Its AI platform, URZA, functions as a real-time decision engine that coordinates autonomous systems much like a chess master: holding the plays in its “head,” understanding the unique rules and capabilities of each piece, and dynamically moving them to achieve mission objectives. As conditions change or assets fail, URZA adapts strategy mid-game, redistributing tasks and re-optimizing outcomes across a distributed fleet rather than relying on any single platform.	\N	125000000	fffac1b9-1762-4e5b-ab60-da92486a17bb_1783944221238.png	{"Bessemer Venture Partners",Outlander,Crosslink,"Draper Associates","Bloomberg Beta",Others}	f	[]	2026-07-13 12:03:41.222091+00	0	\N	2024	Austin	USA	f	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1783951897344_697t3ihik.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1783951901930_we6t0djx7.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1783951905706-5opiis.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1783951916221-a9wcr.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1783951919686-d6y4he.pdf", "title": "Financials"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1783951922924-6ag7bo9.pdf", "title": "Offering Documents"}]	f
ea31eb2d-f09f-44d7-b9b8-1b81f8bd1919	General Intuition	\N	AI / ML	\N	Series A	General Intuition (GI) is building the foundation for next-generation AI by developing world models: systems that learn how the world works so it can see, reason, and act within it.\n\nWhile most frontier AI models are trained on text, language is a low-bandwidth and indirect representation of the world. It cannot teach machines causality, spatial awareness, or how to operate in real time. GI is solving this by focusing on embodied intelligence, models that learn by observing and acting in dynamic environments.\n\nThe company’s core advantage is data. Through Medal, its wholly owned subsidiary, GI captures 1B+ gameplay clips per year, each paired with real human control inputs. This creates a uniquely large and high-signal training corpus for vision-to-action models. Early results show zero-shot transfer across games, semantic understanding of actions, and stable long-horizon behavior using only video and human-style inputs, with no access to game engines or structured state.\n\nGeneral Intuition is now raising a $350M Series A led by Khosla Ventures ($122M commitment), who led GI’s seed in Q2 2025 with $50M, the firm’s largest seed check since OpenAI in 2018. This opportunity was shared directly with AV due to a close relationship with a founding team member and GI’s Head of Defense.	\N	2000000000	ea31eb2d-f09f-44d7-b9b8-1b81f8bd1919_1769105174764.png	{"Khosla Ventures",Hedosophia,"Jeff Bezos","General Catalyst",Hexagon,Futurepresent,Others}	f	[]	2026-01-22 18:06:14.736508+00	0	\N	2024	New York	USA	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775051643335_bz7v15seg.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1775051646701_i34kxoxji.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775051655449-6ugkqz.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775051673994-ee22yt.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775051664752-kmd21j.pdf", "title": "Financial Projections"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778164315582-8oowif.pdf", "title": "Offering Documents"}]	f
49914cda-a3e3-47ec-8faa-fb311c15e734	Replit Inc	\N	AI Native Software	\N	Series D	For decades, creating software required deep technical expertise, expensive infrastructure, and significant time investment. This barrier hasn’t just limited who can build software, it’s limited which problems get solved. Countless ideas never make it past the concept stage because the people who understand the problem best lack the technical skills to build solutions.\n\nReplit is changing that fundamental equation. Its platform combines a cloud-based development environment with AI agents that can take you from idea to deployed application without ever leaving your web browser. While others focus on code completion or depend on third-party integrations, Replit natively handles the entire stack: writing code, managing databases, deploying applications, and hosting them at production scale.\n\nThe opportunity is an enormous $1T multi-layered market. There are 71 million knowledge workers in the U.S. alone who understand problems in their domains but lack the technical skills to build solutions. Globally, Replit is building for the next billion software creators, turning software creation from a specialized skill into something as accessible as writing a document.	\N	9000000000	49914cda-a3e3-47ec-8faa-fb311c15e734_1775047046259.png	{"Georgian Partners","Prysm Capital",YC,Craft,a16z,Coatue,"G Squared","1789 Ventures",QIA}	f	[]	2026-04-01 12:36:29.98774+00	0	\N	2016	San Francisco	USA	f	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775047077485_hppeccj1n.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1775047088156_gaq12heg3.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775047133367-gz33j.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775047142664-ckjmy.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775047114528-god1o.pdf", "title": "Financial Projections"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778159270340-tt3ew.pdf", "title": "Offering Documents"}]	f
737bedf7-abf5-414b-8d49-86553f5bdf1f	Lambda	\N	AI/ML	\N	Pre Series E SAFE	Lambda is a hybrid AI cloud infrastructure provider that offers on-site and cloud-based GPU computing infrastructure, along with a software stack for AI engineers and deep learning operations.\n\nIn June of this year, AV invested in a Pre-Series E SAFE for Lambda, which came with a ~14% discount to the company’s Series E valuation. Lambda was planning to raise its Series E this fall, and we were anticipating the round to be highly oversubscribed, with very limited allocation available to existing investors. This played out exactly as expected. Lambda recently completed its $1.45B Series E round at a $4.7B pre-money valuation, led by TWG Global. Notably, no existing investors, including AV, were given access to this highly sought-after round. This round is expected to be Lambda’s final round of private funding before a potential IPO, with press reports highlighting that JPMorgan, Morgan Stanley and Citi have been selected as underwriters. 	\N	4700000000	737bedf7-abf5-414b-8d49-86553f5bdf1f.png	{"TWG Global","Other Investors (Confidential)","Pre-Series E SAFE Investors"}	f	[]	2026-01-22 14:45:00.775338+00	0	\N	2012	San Francisco	USA	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775051430974_uaaqtb7x3.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1778159066988_jyardtmut.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778159079830-ctj7rm.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778159110817-ril41.pdf", "title": "Financial Projections"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778159231165-40ixi.pdf", "title": "Offering Documents"}]	f
9531217d-8889-4181-a8f8-6c7ed01c6533	Core Automation	\N	AI / ML	\N	Seed	Every major AI lab today — OpenAI, Anthropic, Google DeepMind — is running the same play: scale the transformer, ship predictable gains, and never break stride. Core Automation was founded on the conviction that this caution is what leaves the door open for a team willing to bet differently.\n\nThe 16 co-founders didn’t study the current AI paradigm — they built it. Jerry Tworek led the OpenAI team that created o1, the single largest recent leap in AI performance. His co-founders built Gemini pretraining, FlashAttention-4, GPT-5.5 inference, and the ChatGPT API. They left to pursue the research path the incumbents won’t take: continuously learning, agentic systems that optimize and automate work — starting with their own lab. Against the neolab comp set — Thinking Machines raised at $10B post, Safe Superintelligence at $30B post, both pre-product — Core’s $3.4B post-money is the lowest entry point available among credentialed frontier teams.\n\nReserve if you believe the current transformer-scaling paradigm has a ceiling — and that the team most credibly positioned to build what comes next is the one that built what exists today. Keep diligencing or pass if your blocker is the absence of product or revenue: Core was founded in March 2026, has no customers, and won’t deploy commercially until months 12–24. This is a pure research bet on an exceptional team.	\N	3000000000	9531217d-8889-4181-a8f8-6c7ed01c6533_1784202550647.png	{"Acrew Capital ($150M)","NVIDIA ($100M)",Accel,"Eric Schmidt",Lightspeed,"Menlo Ventures"}	f	[]	2026-07-16 11:48:40.583336+00	0	\N	2026	San Francisco	USA	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1784202451537_83ytomb2j.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1784202459456_9n74af7vg.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1784202477631-3yw6nd.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1784202490118-vzvrsl.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1784202498976-ujspib.pdf", "title": "Financials"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1784202513224-e49wz.pdf", "title": "Offering Documents"}]	f
38ccc935-ce97-4675-8b1d-378331152425	Orion Security	\N	Cybersecurity	\N	Series A	Orion Security is leading a new generation of DLP, rethinking the category from first principles using AI-native infrastructure. The company introduces a fundamentally new approach: instead of static rule-matching, Orion brings a behavioral detection model inspired by Endpoint Detection and Response (EDR) systems that revolutionized malware protection a decade ago. Just as EDR shifted cybersecurity from searching for known threats to monitoring for abnormal behavior, Orion does the same for data. It establishes baseline norms for how sensitive data flows through an organization, who accesses it, how it’s shared, where it moves, and flags deviations that suggest potential leakage. These are what Orion calls Indicators of Leakage (IOLs), analogous to the Indicators of Attack (IOAs) that made CrowdStrike’s EDR a cornerstone of modern security architecture.	\N	70000000	38ccc935-ce97-4675-8b1d-378331152425_1769107759611.png	{"Norwest VP","Insiders (Lama Partners","PICO Partners)","New Investors"}	f	[]	2026-01-22 18:49:19.554028+00	0	\N	2025	Tel Aviv	Israel	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775050951732_iizu92o8b.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1775050955015_ffelttxpk.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775050967866-7awt4q.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775050973713-c5bw8.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778161778412-xxxw6c.pdf", "title": "Offering Documents"}]	f
9bfe0d5e-72a9-4281-b0a2-60d22f8d7e8c	Wasabi	\N	Cloud Storage	\N	Series D-1	Wasabi Technologies is a Boston-based cloud storage company founded in 2017 by CEO and serial entrepreneur Dave Friend. Wasabi provides open, reliable, and easy-to-use cloud storage. Unlike hyperscalers, Wasabi offers a single-tier pricing model with no egress or API fees, and delivers storage at roughly 1/5th the cost of market leader Amazon S3.\n\nWasabi is continuing to scale rapidly. The company reported $133M in 2024 revenue (58% YoY growth) and $154M in annual recurring revenue (+42% YoY growth), with ARR growing to $210M by year-end. Growth has been fueled by a channel partnerships go-to-market strategy, with more than 117,000 resellers globally. This model now drives two-thirds of revenue and has been reinforced by strategic alliances with IBM and Dell. 	\N	1800000000	9bfe0d5e-72a9-4281-b0a2-60d22f8d7e8c_1769107161491.png	{"L2 Point",Others}	f	[]	2026-01-22 18:39:21.471113+00	0	\N	2017	Boston	USA	\N	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1775049197475_78uxzxgcb.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1775049203618_vigqhihck.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775049228329-72hj1.pdf", "title": "Term Sheet"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1775049239469-6lpxrj.pdf", "title": "Financial Projections"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1778163842602-s17loh.pdf", "title": "Offering Documents"}]	f
c028ff66-d43c-459a-9c1d-e307a3765061	Lila Sciences	\N	AI	\N	Series B	The next wave of AI will not be defined only by who has the best model. It will also be defined by who can create the most valuable new data in the real world. Today’s frontier AI systems are still trained largely on existing human knowledge. They can reason over what is already known, but they cannot, on their own, generate new scientific truth. That is why scientific progress still bottlenecks at experimentation across biology, chemistry, materials science, energy, semiconductors, and industrial R&D – markets representing more than $3T of annual spend.\n\nThis is the opportunity Lila Sciences is addressing. Lila is building the platform for Scientific Superintelligence: a closed-loop system that combines frontier AI reasoning with autonomous physical laboratories – called AI Science Factories – to generate hypotheses, run experiments, learn from real-world results, and continuously improve over time. In simple terms, Lila is not just using AI to analyze science – it is using AI to do science. Instead of relying on the same public data as everyone else, Lila has already generated roughly 10T tokens of proprietary scientific reasoning data and is rapidly expanding that advantage through continuous real-world experimentation. This creates a new scaling factor for AI-driven discovery: not simply applying more compute to the same information, but building a system that continuously generates new scientific truth in the real world.	\N	8500000000	c028ff66-d43c-459a-9c1d-e307a3765061_1784202782515.png	{"CalPERS / Engine Ventures","NVentures / NVIDIA (anchor)","Collective Global","March Capital",MGX,"Prime Movers Lab","Ontario Teachers","Tiger Global","Thermo Fisher Scientific",Braidwell,"Craft Ventures",Amazon,Others}	f	[]	2026-07-16 11:52:41.68186+00	0	\N	2023	Cambridge	USA	t	\N	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-memos/1784202718576_ppets2m6a.pdf	https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-decks/1784202725885_1l8mo6zqu.pdf	[{"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1784202732200-laly7h.pdf", "title": "Cap Table"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1784202738428-is0dz.pdf", "title": "Financial Projections"}, {"url": "https://cfpcluxfmkdsfzsyfedo.supabase.co/storage/v1/object/public/deal-documents/deal-media/1784202754733-xroavt.pdf", "title": "Offering Documents"}]	t
\.


--
-- Data for Name: leadership; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leadership (id, name, title, emoji, email, phone, linkedin, bio, notable_investments, is_manager, created_at, co_invests_with, company, location, auth_user_id, must_change_password, profile_visible, show_as_member) FROM stdin;
c56565a9-54f9-4a36-8f3b-3ef9fec75921	Ludwig Schulze	Executive Managing Partner, OIP	👔	ludwig@av.vc			Ludwig has been on all sides of venture — as an entrepreneur, corporate buyer of ventures, and venture capitalist. Before Alumni Ventures, he experienced the daily realities of entrepreneurship as Founder and CEO of a mobile payments venture that served over 12 million people. Earlier, at a Fortune 100 telecommunications manufacturer (Nokia), he held general manager and business development roles that included investing in and acquiring venture-backed businesses. His first experience in venture capital was with an $800 million global fund that focused on enterprise and mobile software both before and after the dot.com crash. Ludwig began his career as a strategy consultant with the Boston Consulting Group. He has a BA from Brown University and an MBA from Columbia. He lives in NYC with his wife and 2 teenagers.		t	2026-05-07 11:46:49.514645+00	{}	Alumni Ventures	New York, NY	e98e1e01-064f-4363-9ae5-290a828cdd4f	t	t	f
e349e771-72d0-4208-8700-96a046737e6c	Yoshi Yamada	Chairman, AV Japan	👔	yoshihisa.yamada@av.vc			Yoshihisa “Yoshi” Yamada is an accomplished business leader and entrepreneur with extensive experience scaling technology, financial, and consumer-platform businesses in Japan. He began his career at the Industrial Bank of Japan and later moved into investment banking at Goldman Sachs Japan. Yoshi joined Rakuten in 2000, where he spent nearly two decades helping the company grow into one of Japan’s leading internet and mobile groups. He led several key businesses—including travel, digital payments, and mobile—and also oversaw corporate finance and M&A as Chief Financial Officer. After leaving Rakuten, he led Try Group, a major education services company in Japan. Today, Yoshi serves on multiple corporate boards, including Mynavi, and advises companies on governance, digital strategy, and new-business development. He holds a Bachelor of Laws from the University of Tokyo and an MBA from Harvard Business School.		t	2026-02-08 17:46:00.13597+00	{}	Alumni Ventures	Tokyo, JP	2533836c-6e26-4a00-bbfb-42c3d7ee7805	f	t	t
a2c3e913-9080-43be-b67e-5826d8262a1a	Cate Woolsey	AI Associate	\N	cate.woolsey@av.vc	9173193250	https://www.linkedin.com/in/catewoolsey/			t	2026-02-05 21:14:50.98871+00	{}	Alumni Ventures	Manchester, NH	499902ce-baae-4f90-baf3-b2d4bbde2847	f	f	f
47403f8b-149e-4fd9-911f-cb04da6e7cc4	Ayla Langer	Associate Director, OIP Business & Investor Relations	👔	ayla@av.vc					t	2026-02-08 17:50:47.280167+00	{}	Alumni Ventures	Chicago, IL	e0c7d92b-4b08-46b9-9bc2-5322b72032f3	f	f	f
73782cf1-993d-49d0-9c0e-403816e0bdd4	Mike Collins	CEO	👔	mike@av.vc			Mike has been involved in almost every facet of venturing, from angel investing to venture capital, new business and product launches, and innovation consulting. He is the CEO of Alumni Ventures and launched AV’s first alumni fund, Green D Ventures, where he oversaw the portfolio as Managing Partner and is now Managing Partner Emeritus. Mike is a serial entrepreneur who has started multiple companies, including Kid Galaxy, Big Idea Group (partially owned by WPP), and RDM. He began his career at VC firm TA Associates. He holds an undergraduate degree in Engineering Science from Dartmouth and an MBA from Harvard Business School.		t	2026-02-08 17:52:05.440782+00	{}	Alumni Ventures	Manchester, NH	fd0f745f-0b31-4762-b918-b9c6bf5c4b34	f	t	f
fdcd687b-73a2-4489-8e22-40e6b830b1d3	Michael Phillips	Chief Legal Officer & Executive Managing Director, Japan	👔	mgp@av.vc			Michael has led legal and business teams in a variety of settings, from large financial services companies to start-ups. As a Managing Director at TIAA/Nuveen, he helped grow the asset management business to over $900 billion AUM, by forming new boutique registered investment advisors (RIAs) and developing alternative investment products distributed in the US and internationally across retail, institutional and high net worth clients.  From there he co-founded an innovative investment advisory platform designed to align the interests of agencies, communities and institutional investors in large-scale infrastructure projects, serving as GC/COO and successfully raising institutional capital.  Michael’s 25+ years of experience includes legal practice for major U.S. law firms (Faegre Drinker and Richards Layton) and other diversified financial services companies (Northern Trust and The Hartford). He is a CFA Charterholder and former U.S. Army Lieutenant. He earned a BA (English) from Dartmouth, a JD (Law) from William & Mary, an LLM (Taxation) from Villanova, and an MBA (Finance) from Wharton. Michael has a lifelong interest in arts and education, previously serving as a Director of a community arts foundation that founded and operated an arts-based Charter School, as well as recently developing and leading a multi-part training program for corporate employees to foster diversity and inclusion through the lens of art. Current initiatives include serving as a Director of Joy2Learn, a non-profit organization promoting the use of the arts in K-12 education, and advising education technology start-ups.		t	2026-05-07 11:50:29.90505+00	{}	Alumni Ventures	Tokyo, Japan	46255a5d-33be-4886-8629-714665b67d7d	t	t	f
1a854389-1ab0-487f-967c-28687c7e8246	Ryan Nakata	Head of Japan	👔	ryan.nakata@av.vc			Ryutaro "Ryan" Nakata is an innovation executive with 15+ years of experience driving new business creation, strategic partnerships, and ecosystem development across Japan and the United States. He is also the Founder and CEO of s’more works Inc., a company that connects Japan’s top universities with global innovation ecosystems and supports national programs to strengthen Japan’s deep-tech and startup landscape. Ryan has held innovation and new business development leadership roles at major global enterprises, where he built cross-divisional initiatives across mobility, decarbonization, supply chain, and advanced manufacturing. He has led strategic collaborations with global top-tier VCs, U.S. universities, and research institutions, and has run open innovation and corporate venture initiatives in Silicon Valley. He began his career at Mitsui & Co., where he launched cross-border businesses and later served in the company’s Silicon Valley office leading global corporate innovation efforts. He holds a BA in International Economics from Yokohama National University and operates between Japan and the U.S.		t	2026-02-08 17:49:55.200753+00	{}	Alumni Ventures		0eec2641-f005-48fb-9edd-5bebbe1b82f3	t	t	t
\.


--
-- Data for Name: member_investments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_investments (id, member_id, deal_id, member_name, deal_name, amount, date, notes, created_at) FROM stdin;
\.


--
-- Data for Name: members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.members (id, name, email, phone, company, title, location, linkedin, emoji, interests, bio, is_board, last_login, deals_viewed, sessions_attended, created_at, auth_user_id, must_change_password) FROM stdin;
fefee279-46df-4630-9423-189265cc63c6	Daisuke Asahara	daisukeasahara@gmail.com	\N	浅原 大輔	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-03-19 13:04:57.770822+00	bf0fd1c5-5cdb-40d9-86a3-eb4e6b5bc658	t
00d49849-f63d-497e-9a4c-5e92196d9f72	Tatsuo Kawasaki	tatsktokyo@me.com	\N	川﨑 達生	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-03-19 13:05:13.902265+00	984c0642-a298-47c3-8240-410294037f9d	t
a752c81a-630e-4235-8802-2e029c718535	Atsushi Mizushima	atsmzsm@gmail.com	\N	水島 淳	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-03-19 13:04:02.761409+00	df69585e-fb90-4806-9ddf-edde746e0e88	f
a4cb8c8a-f5c4-4aa0-91f5-8d9348848fdc	Eijiro Imai	eijiro.imai@gmail.com	\N	KIキャピタル株式会社	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-04-10 15:24:11.51543+00	0ac3a8ee-cc06-4762-b87a-a68a53dba47e	t
df2d3e96-feec-4d2c-8e4a-5d7553da5ebb	Takashi Mitachi	mitachi.takashi@gmail.com	\N	御立 尚資	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-03-19 13:05:28.313416+00	728f534a-f69d-403f-a540-919a730d2200	f
c4e57eb1-d659-48b3-95b2-12a848d7d00c	Masato Miki	mmiki@bcmkk.co.jp	\N	三木 真人	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-03-19 13:06:01.337955+00	7a233921-8b00-4b76-92ae-116698400db1	f
073a2909-7a68-4e68-835f-e7e457ff36d4	Izumi Nishiaki	nishizaki@nmbs.jp	\N	泉西崎	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-06-15 19:48:10.560858+00	2ce0c911-8a19-4eab-9beb-056cb30c02f7	t
e7f8cd6b-ecd8-450f-aa65-ab7264744b02	Nami Hamada	hamada.nami@gmail.com	\N	濱田奈巳	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-06-15 19:44:39.327559+00	7feec9fc-1569-4c16-9e93-16b90826eb7c	f
375bdfd9-7585-4111-9bee-fb3f473e4630	Atsushi Egawa	atsushi.egawa@gmail.com	\N	江川昌史	\N	Tokyo	\N	🏢	{}	\N	f	\N	0	0	2026-03-19 13:07:02.021745+00	346c1329-e3aa-4271-b7a5-88f2bc76a664	f
\.


--
-- Data for Name: recruits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recruits (id, name, email, phone, company, location, linkedin, source, av_lead, stage, notes, created_at) FROM stdin;
2d4d692e-fd57-43fd-b8fa-6bf0e73c5e94	Daisuke Asahara	daisukeasahara@gmail.com	\N	浅原 大輔	Tokyo	\N	events	\N	uploaded	\N	2026-03-19 13:04:58.226793+00
766acebb-5750-460f-a0ed-da3af495f0ad	Tatsuo Kawasaki	tatsktokyo@me.com	\N	川﨑 達生	Tokyo	\N	events	\N	uploaded	\N	2026-03-19 13:05:14.290473+00
f277922c-accd-491a-b283-a61070a9d9fc	Takashi Mitachi	mitachi.takashi@gmail.com	\N	御立 尚資	Tokyo	\N	events	\N	uploaded	\N	2026-03-19 13:05:28.655452+00
73cf4956-8623-450b-b8bf-d2221182640c	Masato Miki	mmiki@bcmkk.co.jp	\N	三木 真人	Tokyo	\N	events	\N	uploaded	\N	2026-03-19 13:06:01.697604+00
93ef1d37-b84c-4048-8ffe-ba2d6bc407b5	Atsushi Egawa	atsushi.egawa@gmail.com	\N	江川昌史	Tokyo	\N	events	\N	uploaded	\N	2026-03-19 13:07:02.436131+00
05dde626-7c4c-43fe-b9fc-a971296989b6	Eijiro Imai	eijiro.imai@gmail.com	\N	KIキャピタル株式会社	Tokyo	\N	events	\N	uploaded	\N	2026-04-10 15:24:11.877769+00
17590c96-0515-49ef-8613-aaafe0bce6ff	Atsushi Mizushima	atsmzsm@gmail.com	\N	水島 淳	Tokyo	\N	events	\N	uploaded	\N	2026-03-19 13:04:03.156949+00
686c0db3-0ef1-47b5-ad8f-9a7c0bea4cb5	Nami Hamada	hamada.nami@gmail.com	\N	奈巳濱田	Tokyo	\N	events	\N	uploaded	\N	2026-06-15 19:44:39.725095+00
7d2bc682-69d0-4847-9ea2-006926c27cf7	Izumi Nishiaki	nishizaki@nmbs.jp	\N	泉西崎	Tokyo	\N	events	\N	uploaded	\N	2026-06-15 19:48:10.899508+00
\.


--
-- Data for Name: syndication_deals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.syndication_deals (id, name, name_ja, sector, sector_ja, stage, description, description_ja, valuation, check_size, logo, co_investors, dd_complete, dd_reports, syndication_status, created_at, sort_order, meeting_url, year_established, city, country, is_pre_money, memo_url, deck_url, additional_media, valuation_approximate) FROM stdin;
\.


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: archived_deals archived_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archived_deals
    ADD CONSTRAINT archived_deals_pkey PRIMARY KEY (id);


--
-- Name: co_investors co_investors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_investors
    ADD CONSTRAINT co_investors_pkey PRIMARY KEY (id);


--
-- Name: deal_interests deal_interests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_interests
    ADD CONSTRAINT deal_interests_pkey PRIMARY KEY (id);


--
-- Name: dinners dinners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dinners
    ADD CONSTRAINT dinners_pkey PRIMARY KEY (id);


--
-- Name: discussions discussions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussions
    ADD CONSTRAINT discussions_pkey PRIMARY KEY (id);


--
-- Name: fund_holdings fund_holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_holdings
    ADD CONSTRAINT fund_holdings_pkey PRIMARY KEY (id);


--
-- Name: leadership leadership_auth_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leadership
    ADD CONSTRAINT leadership_auth_user_id_unique UNIQUE (auth_user_id);


--
-- Name: leadership leadership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leadership
    ADD CONSTRAINT leadership_pkey PRIMARY KEY (id);


--
-- Name: member_investments member_investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_investments
    ADD CONSTRAINT member_investments_pkey PRIMARY KEY (id);


--
-- Name: members members_auth_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_auth_user_id_unique UNIQUE (auth_user_id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: recruits recruits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruits
    ADD CONSTRAINT recruits_pkey PRIMARY KEY (id);


--
-- Name: syndication_deals syndication_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syndication_deals
    ADD CONSTRAINT syndication_deals_pkey PRIMARY KEY (id);


--
-- Name: idx_deal_interests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_interests_created_at ON public.deal_interests USING btree (created_at DESC);


--
-- Name: idx_deal_interests_deal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_interests_deal_id ON public.deal_interests USING btree (deal_id);


--
-- Name: idx_deal_interests_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_interests_member_id ON public.deal_interests USING btree (member_id);


--
-- Name: idx_deal_interests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_interests_status ON public.deal_interests USING btree (status);


--
-- Name: idx_leadership_auth_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leadership_auth_user_id ON public.leadership USING btree (auth_user_id);


--
-- Name: idx_members_auth_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_auth_user_id ON public.members USING btree (auth_user_id);


--
-- Name: deal_interests update_deal_interests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_deal_interests_updated_at BEFORE UPDATE ON public.deal_interests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leadership leadership_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leadership
    ADD CONSTRAINT leadership_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: members members_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: activity_log Admins can add to activity log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can add to activity log" ON public.activity_log FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: archived_deals Admins can manage archived deals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage archived deals" ON public.archived_deals USING (public.is_admin());


--
-- Name: member_investments Admins can manage investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage investments" ON public.member_investments USING (public.is_admin());


--
-- Name: recruits Admins can manage recruits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage recruits" ON public.recruits USING (public.is_admin());


--
-- Name: co_investors Admins can modify co-investors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can modify co-investors" ON public.co_investors USING (public.is_admin());


--
-- Name: activity_log Admins can view activity log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view activity log" ON public.activity_log FOR SELECT USING (public.is_admin());


--
-- Name: announcements Admins can view all announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all announcements" ON public.announcements FOR SELECT USING (public.is_admin());


--
-- Name: member_investments Admins can view all investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all investments" ON public.member_investments FOR SELECT USING (public.is_admin());


--
-- Name: fund_holdings Allow all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all" ON public.fund_holdings USING (true) WITH CHECK (true);


--
-- Name: syndication_deals Allow all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all" ON public.syndication_deals USING (true) WITH CHECK (true);


--
-- Name: activity_log Allow authenticated users full access to activity_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to activity_log" ON public.activity_log TO authenticated USING (true) WITH CHECK (true);


--
-- Name: announcements Allow authenticated users full access to announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to announcements" ON public.announcements TO authenticated USING (true) WITH CHECK (true);


--
-- Name: archived_deals Allow authenticated users full access to archived_deals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to archived_deals" ON public.archived_deals TO authenticated USING (true) WITH CHECK (true);


--
-- Name: co_investors Allow authenticated users full access to co_investors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to co_investors" ON public.co_investors TO authenticated USING (true) WITH CHECK (true);


--
-- Name: deal_interests Allow authenticated users full access to deal_interests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to deal_interests" ON public.deal_interests TO authenticated USING (true) WITH CHECK (true);


--
-- Name: dinners Allow authenticated users full access to dinners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to dinners" ON public.dinners TO authenticated USING (true) WITH CHECK (true);


--
-- Name: discussions Allow authenticated users full access to discussions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to discussions" ON public.discussions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fund_holdings Allow authenticated users full access to fund_holdings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to fund_holdings" ON public.fund_holdings TO authenticated USING (true) WITH CHECK (true);


--
-- Name: member_investments Allow authenticated users full access to member_investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to member_investments" ON public.member_investments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: recruits Allow authenticated users full access to recruits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to recruits" ON public.recruits TO authenticated USING (true) WITH CHECK (true);


--
-- Name: syndication_deals Allow authenticated users full access to syndication_deals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users full access to syndication_deals" ON public.syndication_deals TO authenticated USING (true) WITH CHECK (true);


--
-- Name: leadership Allow authenticated users to delete leadership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to delete leadership" ON public.leadership FOR DELETE TO authenticated USING (true);


--
-- Name: members Allow authenticated users to delete members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to delete members" ON public.members FOR DELETE TO authenticated USING (true);


--
-- Name: leadership Allow authenticated users to insert leadership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert leadership" ON public.leadership FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: members Allow authenticated users to insert members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert members" ON public.members FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: leadership Allow authenticated users to read leadership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read leadership" ON public.leadership FOR SELECT TO authenticated USING (true);


--
-- Name: members Allow authenticated users to read members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read members" ON public.members FOR SELECT TO authenticated USING (true);


--
-- Name: leadership Allow authenticated users to update leadership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update leadership" ON public.leadership FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: members Allow authenticated users to update members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update members" ON public.members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: deal_interests Anyone can create interests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create interests" ON public.deal_interests FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: deal_interests Anyone can delete interests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete interests" ON public.deal_interests FOR DELETE TO authenticated USING (true);


--
-- Name: deal_interests Anyone can update interests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update interests" ON public.deal_interests FOR UPDATE TO authenticated USING (true);


--
-- Name: deal_interests Anyone can view interests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view interests" ON public.deal_interests FOR SELECT TO authenticated USING (true);


--
-- Name: leadership Authenticated users can view leadership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view leadership" ON public.leadership FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: members Authenticated users can view members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view members" ON public.members FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: co_investors Everyone can view co-investors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view co-investors" ON public.co_investors FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: dinners Everyone can view dinners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view dinners" ON public.dinners FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: discussions Everyone can view discussions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view discussions" ON public.discussions FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: announcements Everyone can view published announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view published announcements" ON public.announcements FOR SELECT USING (((auth.uid() IS NOT NULL) AND (status = 'published'::text)));


--
-- Name: leadership Leadership can update own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leadership can update own record" ON public.leadership FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text)))));


--
-- Name: dinners Users can RSVP to dinners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can RSVP to dinners" ON public.dinners FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: discussions Users can RSVP to discussions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can RSVP to discussions" ON public.discussions FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: members Users can update own member record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own member record" ON public.members FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text))))) WITH CHECK (((auth.uid() IS NOT NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text)))));


--
-- Name: member_investments Users can view own investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own investments" ON public.member_investments FOR SELECT USING ((member_id IN ( SELECT members.id
   FROM public.members
  WHERE (members.email = public.current_user_email()))));


--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: archived_deals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.archived_deals ENABLE ROW LEVEL SECURITY;

--
-- Name: co_investors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.co_investors ENABLE ROW LEVEL SECURITY;

--
-- Name: deal_interests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deal_interests ENABLE ROW LEVEL SECURITY;

--
-- Name: dinners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dinners ENABLE ROW LEVEL SECURITY;

--
-- Name: discussions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_holdings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_holdings ENABLE ROW LEVEL SECURITY;

--
-- Name: leadership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leadership ENABLE ROW LEVEL SECURITY;

--
-- Name: member_investments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_investments ENABLE ROW LEVEL SECURITY;

--
-- Name: members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

--
-- Name: recruits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recruits ENABLE ROW LEVEL SECURITY;

--
-- Name: syndication_deals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.syndication_deals ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict ahuZBRJgR5JgTORYeTf6o0iLNGOm0ggiV20Ps2fRvHIZpugMQ9HYufwNGkgx6IS

