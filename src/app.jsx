// KIZUNA CLUB v14 - Production with Supabase Auth (FIXED)
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "./lib/supabaseClient";
import { colors } from "./constants/theme";
import { Toast } from "./components/ui";
import { t, EN } from "./constants/strings";
import { genId } from "./utils/random";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import { LoginModal } from "./components/auth/LoginModal";

// Import Admin Components
import {
  AdminDashboard,
  AdminMembers,
  AdminDeals,
  AdminMemberPortfolios,
  AdminEvents,
  AdminAnnouncements,
  AdminActivityLog
} from "./components/admin";

// Import User Components
import {
  Dashboard,
  PortfolioView,
  EventsView,
  MyPortfolioView,
  CommunityView,
  ProfileView,
  MemberProfileView,
  DealDetailPage,
  BoardView,
  AnnouncementsView
} from "./components/user";

const titles = {
  'admin-dashboard': 'Admin Dashboard',
  'admin-members': 'Manage Members',
  'admin-member-portfolios': 'Member Portfolios',
  'admin-deals': 'Manage Deals',
  'admin-events': 'Manage Events',
  'admin-announcements': 'Announcements',
  'admin-log': 'Activity Log',
  'dashboard': 'Dashboard',
  'events': 'Events',
  'portfolio': 'Portfolio',
  'community': 'Community',
  'announcements': 'Announcements',
  'my-portfolio': 'My Portfolio',
  'profile': 'Profile'
};

// MAIN APP - With Proper Supabase Authentication
export default function App() {
  // Check for board route
  const isBoardRoute = window.location.pathname === '/board' || window.location.hash === '#board';
  if (isBoardRoute) {
    return <BoardView />;
  }
  
  // Auth state
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [passwordChangeInProgress, setPasswordChangeInProgress] = useState(false);
  const [memberNeedingPasswordChange, setMemberNeedingPasswordChange] = useState(null);
  const [hasCheckedPasswordRequirement, setHasCheckedPasswordRequirement] = useState(false);
  const [pendingMfa, setPendingMfa] = useState(() => sessionStorage.getItem('kizuna_pending_mfa') === 'true');
  const [canBeAdmin, setCanBeAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = localStorage.getItem('kizuna_isAdmin');
    return saved === 'true';
  });
  
  // UI state
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('kizuna_currentView');
    return saved || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMember, setViewMember] = useState(null);
  const [viewDeal, setViewDeal] = useState(null);
  
  // Data state - start with empty structures, load everything from Supabase
  const [data, setData] = useState({
    leadership: [],
    members: [],
    discussions: [],
    fundHoldings: [],
    syndicationDeals: [],
    archivedDeals: [],
    dinners: [],
    announcements: [],
    activityLog: [],
    memberInvestments: [],
    recruits: [],
  });
  const [dataLoading, setDataLoading] = useState(true);
  
  // Track if data has been loaded to prevent reloading on tab switch
  const dataLoadedRef = useRef(false);
  // Track which auth user ID has already had its profile loaded, so repeated
  // auth events (TOKEN_REFRESHED, SIGNED_IN re-fires on tab refocus) don't
  // re-trigger the profile load + spinner flicker.
  const loadedAuthUserIdRef = useRef(null);
  
  // Initialize auth listener
  useEffect(() => {
    console.log('🚀 Auth listener initialized');
    
    // Get initial session (with refresh fallback to avoid logout on reload)
    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        }
        let session = data?.session ?? null;

        if (!session) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Error refreshing session:', refreshError);
          } else {
            session = refreshed?.session ?? null;
          }
        }

        console.log('📋 Initial session check:', session ? 'Session exists' : 'No session');
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const pendingMfaNow = sessionStorage.getItem('kizuna_pending_mfa') === 'true';
          const magicLinkCallback = isMagicLinkCallback();
          const mfaPasswordPhase = sessionStorage.getItem('kizuna_mfa_password_phase') === 'true';
          const mfaLinkSent = sessionStorage.getItem('kizuna_mfa_link_sent') === 'true';
          if (pendingMfaNow && !magicLinkCallback && mfaPasswordPhase) {
            console.log('Pending MFA: ignoring password-phase session during initial load');
            setProfileLoading(false);
          } else if (pendingMfaNow && !magicLinkCallback && !mfaLinkSent) {
            console.log('Pending MFA: waiting for magic link completion');
            setProfileLoading(false);
          } else {
            setProfileLoading(true);
          }
        }
        setAuthLoading(false);
        if (session?.user) {
          const pendingMfaNow = sessionStorage.getItem('kizuna_pending_mfa') === 'true';
          const magicLinkCallback = isMagicLinkCallback();
          const mfaPasswordPhase = sessionStorage.getItem('kizuna_mfa_password_phase') === 'true';
          const mfaLinkSent = sessionStorage.getItem('kizuna_mfa_link_sent') === 'true';
          if (!pendingMfaNow || magicLinkCallback || (mfaLinkSent && !mfaPasswordPhase)) {
            loadUserProfile(session.user);
          }
        }
      } catch (err) {
        console.error('Error initializing session:', err);
        setAuthLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('🔔 Auth state changed. Event:', _event, 'Session:', session ? 'exists' : 'null');
      if (!session) {
        if (_event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setCanBeAdmin(false);
          setIsAdmin(false);
          setProfileLoading(false);
          loadedAuthUserIdRef.current = null;
        }
        return;
      }

      // If this auth user's profile is already loaded, just refresh the session
      // reference without re-running profile load (which would flash the spinner).
      // This handles tab refocus and routine TOKEN_REFRESHED events.
      if (loadedAuthUserIdRef.current === session.user.id) {
        setSession(session);
        setUser(session.user);
        return;
      }

      setSession(session);
      setUser(session.user);
      if (session.user) {
        const pendingMfaNow = sessionStorage.getItem('kizuna_pending_mfa') === 'true';
        const magicLinkCallback = isMagicLinkCallback();
        const mfaPasswordPhase = sessionStorage.getItem('kizuna_mfa_password_phase') === 'true';
        const mfaLinkSent = sessionStorage.getItem('kizuna_mfa_link_sent') === 'true';
        if (pendingMfaNow && !magicLinkCallback && mfaPasswordPhase) {
          console.log('Pending MFA: ignoring password-phase auth state change');
          setProfileLoading(false);
        } else if (pendingMfaNow && !magicLinkCallback && !mfaLinkSent && _event !== 'SIGNED_IN') {
          console.log('Pending MFA: waiting for magic link completion');
          setProfileLoading(false);
        } else {
          setProfileLoading(true);
        }
      }
      if (_event !== 'TOKEN_REFRESHED' && session.user) {
        const pendingMfaNow = sessionStorage.getItem('kizuna_pending_mfa') === 'true';
        const magicLinkCallback = isMagicLinkCallback();
        const mfaPasswordPhase = sessionStorage.getItem('kizuna_mfa_password_phase') === 'true';
        const mfaLinkSent = sessionStorage.getItem('kizuna_mfa_link_sent') === 'true';
        if (!pendingMfaNow || magicLinkCallback || ((_event === 'SIGNED_IN' || mfaLinkSent) && !mfaPasswordPhase)) {
          loadUserProfile(session.user);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persist current view to sessionStorage
  useEffect(() => {
    localStorage.setItem('kizuna_currentView', view);
  }, [view]);

  // Reset scroll to top whenever the user navigates to a different view or opens
  // a member/deal detail page. Skip on initial mount to avoid fighting browser
  // scroll restoration. AnnouncementsView's own deep-link scroll runs after this.
  const didMountScrollRef = useRef(false);
  useEffect(() => {
    if (!didMountScrollRef.current) {
      didMountScrollRef.current = true;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [view, viewMember, viewDeal]);

  // Persist admin mode to sessionStorage
  useEffect(() => {
    localStorage.setItem('kizuna_isAdmin', isAdmin.toString());
  }, [isAdmin]);

  useEffect(() => {
    sessionStorage.setItem('kizuna_pending_mfa', pendingMfa ? 'true' : 'false');
  }, [pendingMfa]);

  const isMagicLinkCallback = () => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return (
      search.includes('mfa=1') ||
      hash.includes('type=magiclink') ||
      hash.includes('type=email') ||
      search.includes('type=magiclink') ||
      search.includes('type=email')
    );
  };

  // Load user profile and check admin status
  const loadUserProfile = async (authUser) => {
    loadedAuthUserIdRef.current = authUser.id;
    setProfileLoading(true);
    try {
      console.log('Loading profile for auth user:', authUser.id, authUser.email);
      
      const hasActiveSessionForUser = async () => {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        return !!currentSession && currentSession.user?.id === authUser.id;
      };
      
      // Try to find user in members table BY auth_user_id (NOT email!)
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single();
      
      if (memberError && memberError.code !== 'PGRST116') {
        console.error('Error loading member data:', memberError);
      }
      
      if (memberData) {
        if (!(await hasActiveSessionForUser())) {
          console.log('Skipping stale member profile load: session no longer active for user', authUser.id);
          return;
        }
        console.log('Found member:', memberData);
        
        const profileData = {
          id: memberData.id,
          name: memberData.name,
          nameEn: memberData.name,  // For backward compatibility in React state
          email: memberData.email,
          emoji: memberData.emoji || '👤',
          title: memberData.title,
          company: memberData.company,
          location: memberData.location,
          phone: memberData.phone,
          linkedin: memberData.linkedin,
          bio: memberData.bio,
          interests: memberData.interests || [],
          isManager: false  // Members are not managers
        };
        
        console.log('Setting user profile to:', profileData);
        setUserProfile(profileData);
        setHasCheckedPasswordRequirement(true);
        if (memberData.must_change_password) {
          setPasswordChangeInProgress(true);
          setMemberNeedingPasswordChange(memberData);
        }
        
        // Check admin status from is_board field
        const hasAdminAccess = memberData.is_board || false;
        setCanBeAdmin(hasAdminAccess);
        
        // Handle isAdmin state
        const savedIsAdmin = localStorage.getItem('kizuna_isAdmin');
        if (!hasAdminAccess) {
          setIsAdmin(false);
        } else if (savedIsAdmin === null) {
          // First login with admin access - default to admin mode
          setIsAdmin(true);
        }
        
        // Handle initial view
        const savedView = localStorage.getItem('kizuna_currentView');
        if (savedView === null) {
          // First login - set default view based on admin access
          setView(hasAdminAccess ? 'admin-dashboard' : 'dashboard');
        }
        
      } else {
        // If not in members, try leadership table
        const { data: leadershipData, error: leadershipError } = await supabase
          .from('leadership')
          .select('*')
          .eq('auth_user_id', authUser.id)
          .single();
        
        if (leadershipError && leadershipError.code !== 'PGRST116') {
          console.error('Error loading leadership data:', leadershipError);
        }
        
        if (leadershipData) {
          if (!(await hasActiveSessionForUser())) {
            console.log('Skipping stale leadership profile load: session no longer active for user', authUser.id);
            return;
          }
          console.log('Found leadership:', leadershipData);
          
          const profileData = {
            id: leadershipData.id,
            name: leadershipData.name,
            nameEn: leadershipData.name,
            email: leadershipData.email,
            emoji: leadershipData.emoji || '👔',
            title: leadershipData.title,
            company: leadershipData.company || 'Alumni Ventures',
            location: leadershipData.location || 'Boston / Tokyo',
            phone: leadershipData.phone,
            linkedin: leadershipData.linkedin,
            bio: leadershipData.bio,
            isManager: leadershipData.is_manager || true,  // Leadership are managers
            notableInvestments: leadershipData.notable_investments,
            coInvestors: leadershipData.co_invests_with
          };
          
          console.log('Setting leadership profile to:', profileData);
          setUserProfile(profileData);
          setHasCheckedPasswordRequirement(true);
          if (leadershipData.must_change_password) {
            setPasswordChangeInProgress(true);
            setMemberNeedingPasswordChange(leadershipData);
          }
          
          // Leadership are always admin
          setCanBeAdmin(true);
          
          const savedIsAdmin = localStorage.getItem('kizuna_isAdmin');
          if (savedIsAdmin === null) {
            setIsAdmin(true);
          }
          
          const savedView = localStorage.getItem('kizuna_currentView');
          if (savedView === null) {
            setView('admin-dashboard');
          }
        } else {
          console.error('No member or leadership record found for auth user');
          // Sign out if no matching record
          await supabase.auth.signOut();
          alert('Your account is not linked to a member record. Please contact an administrator.');
        }
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      // Clear so a subsequent auth event can retry instead of being silently skipped.
      loadedAuthUserIdRef.current = null;
    } finally {
      setProfileLoading(false);
    }
  };

  const [originalData, setOriginalData] = useState("");

  const handleToggleAdmin = () => setIsAdmin((prev) => !prev);

  useEffect(() => {
    if (isAdmin && !view.startsWith('admin-')) {
      setView('admin-dashboard');
      return;
    }
    if (!isAdmin && view.startsWith('admin-')) {
      setView('dashboard');
    }
  }, [isAdmin, view]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      sessionStorage.clear();
      localStorage.removeItem('kizuna_currentView');
      localStorage.removeItem('kizuna_isAdmin');
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setCanBeAdmin(false);
      setIsAdmin(false);
      setView('dashboard');
      dataLoadedRef.current = false;
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const loadDataFromSupabase = async () => {
    try {
      setDataLoading(true);
      
      const [leadershipRes, membersRes, discussionsRes, fundHoldingsRes, syndicationRes, dinnersRes, announcementsRes, activityRes, recruitsRes, investmentsRes] = await Promise.all([
        supabase.from('leadership').select('*').order('created_at'),
        supabase.from('members').select('*').order('created_at'),
        supabase.from('discussions').select('*').order('date', { ascending: false }),
        supabase.from('fund_holdings').select('*').order('sort_order'),
        supabase.from('syndication_deals').select('*').order('sort_order'),
        supabase.from('dinners').select('*').order('date', { ascending: false }),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('activity_log').select('*').order('timestamp', { ascending: false }),
        supabase.from('recruits').select('*').order('created_at', { ascending: false }),
        supabase.from('member_investments').select('*').order('created_at')
      ]);
      
      const mapLeadership = (l) => ({ ...l, nameEn: l.name, titleEn: l.title, bioEn: l.bio, coInvestors: l.co_invests_with || [], notableInvestments: l.notable_investments, isManager: l.is_manager });
      const mapMember = (m) => ({ ...m, nameEn: m.name, geography: m.location || '', companyName: m.company, lastLogin: m.last_login, dealsViewed: m.deals_viewed, sessionsAttended: m.sessions_attended });
      const mapDiscussion = (d) => ({ ...d, titleJa: d.title_ja, descriptionJa: d.description_ja, topicJa: d.topic_ja, zoomLink: d.zoom_link, isUpcoming: d.is_upcoming, rsvpYes: d.rsvp_yes || [], rsvpNo: d.rsvp_no || [], notResponded: d.not_responded || [], meetingUrl: d.meeting_url, endDate: d.end_date });
      const mapDeal = (d) => ({ ...d, companyName: d.name, nameJa: d.name_ja, sectorJa: d.sector_ja, descriptionJa: d.description_ja, coInvestors: d.co_investors || [], ddComplete: d.dd_complete, ddReports: d.dd_reports || [], syndicationStatus: d.syndication_status, sortOrder: d.sort_order, meetingUrl: d.meeting_url, yearEstablished: d.year_established, checkSize: d.check_size, isPreMoney: d.is_pre_money, isApproximate: d.valuation_approximate === true });
      const mapDinner = (d) => ({ ...d, titleJa: d.title_ja, venueJa: d.venue_ja, notAttending: d.not_attending || [], notResponded: d.not_responded || [], attendees: d.attendees || [], isUpcoming: d.is_upcoming, endDate: d.end_date });
      const mapAnnouncement = (a) => ({ ...a, titleJa: a.title_ja, contentJa: a.content_ja, scheduledDate: a.scheduled_date });
      const mapLog = (l) => ({ ...l, detailsJa: l.details_ja, user: l.user_name });
      const mapRecruit = (r) => ({ ...r, avLead: r.av_lead, createdAt: r.created_at });
      const mapInvestment = (i) => ({ ...i, memberId: i.member_id, dealId: i.deal_id, memberName: i.member_name, dealName: i.deal_name });
      
      // Load all data from Supabase only - no fallbacks to INITIAL_DATA
      const leadershipData = (leadershipRes.data || []).map(mapLeadership);
      const membersData = (membersRes.data || []).map(mapMember);
      const discussionsData = (discussionsRes.data || []).map(mapDiscussion);
      const fundHoldingsData = (fundHoldingsRes.data || []).map(mapDeal);
      const syndicationData = (syndicationRes.data || []).map(mapDeal);
      const dinnersData = (dinnersRes.data || []).map(mapDinner);
      const announcementsData = (announcementsRes.data || []).map(mapAnnouncement);
      const activityData = (activityRes.data || []).map(mapLog);
      const recruitsData = (recruitsRes.data || []).map(mapRecruit);
      const investmentsData = (investmentsRes.data || []).map(mapInvestment);
      
      setData({
        leadership: leadershipData,
        members: membersData,
        discussions: discussionsData,
        fundHoldings: fundHoldingsData,
        syndicationDeals: syndicationData,
        archivedDeals: [],
        dinners: dinnersData,
        announcements: announcementsData,
        activityLog: activityData,
        memberInvestments: investmentsData,
        recruits: recruitsData,
      });
      
      setOriginalData(JSON.stringify({
        leadership: leadershipData,
        members: membersData,
        discussions: discussionsData,
        fundHoldings: fundHoldingsData,
        syndicationDeals: syndicationData,
        dinners: dinnersData,
        announcements: announcementsData,
        memberInvestments: investmentsData,
        recruits: recruitsData,
      }));
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setDataLoading(false);
    }
  };
  
  useEffect(() => {
    // Only load data once when user logs in, not on every session refresh
    if (session && !dataLoadedRef.current) {
      loadDataFromSupabase();
      dataLoadedRef.current = true;
    } else if (!session) {
      // Reset when user logs out
      setDataLoading(false);
      dataLoadedRef.current = false;
    }
  }, [session]);
  
  const updateData = (newData) => setData(newData);
  
  const addLog = (type, details, detailsJa = '') => {
    const newLog = {
      id: genId(),
      type,
      details,
      detailsJa: detailsJa || details,
      user: userProfile?.name || 'Admin',
      timestamp: new Date().toISOString(),
    };

    setData(prev => ({ ...prev, activityLog: [newLog, ...prev.activityLog] }));

    supabase
      .from('activity_log')
      .insert({
        id: newLog.id,
        type: newLog.type,
        details: newLog.details,
        details_ja: newLog.detailsJa,
        user_name: newLog.user,
        timestamp: newLog.timestamp
      })
      .select()
      .single()
      .then(({ data: saved, error }) => {
        if (error) {
          console.error('Error saving activity log:', error);
          return;
        }
        if (!saved) return;
        setData(prev => ({
          ...prev,
          activityLog: prev.activityLog.map((log) =>
            log.id === newLog.id
              ? { ...saved, detailsJa: saved.details_ja, user: saved.user_name }
              : log
          )
        }));
      });
  };
  
  const handleBack = () => {
    setViewMember(null);
    setViewDeal(null);
  };
  
  const handleViewMember = (member) => setViewMember(member);
  const handleViewDeal = (deal) => setViewDeal(deal);
  
  const renderView = () => {
    if (viewDeal) return <DealDetailPage deal={viewDeal} onBack={handleBack} t={t} isSyndication={data.syndicationDeals.some(d => d.id === viewDeal.id)} userProfile={userProfile} backLabel={view === 'dashboard' ? t.backToDashboard : t.backToPortfolio} />;
    if (viewMember) return <MemberProfileView member={viewMember} onBack={handleBack} t={t} data={data} />;
    switch (view) {
      case 'admin-dashboard': return <AdminDashboard t={t} setCurrentView={setView} data={data} />;
      case 'admin-members': return <AdminMembers t={t} data={data} setData={updateData} addLog={addLog} />;
      case 'admin-member-portfolios': return <AdminMemberPortfolios t={t} data={data} setData={updateData} addLog={addLog} />;
      case 'admin-deals': return <AdminDeals t={t} data={data} setData={updateData} addLog={addLog} onViewDeal={handleViewDeal} />;
      case 'admin-events': return <AdminEvents t={t} data={data} setData={updateData} addLog={addLog} />;
      case 'admin-announcements': return <AdminAnnouncements t={t} data={data} setData={updateData} addLog={addLog} userProfile={userProfile} />;
      case 'admin-log': return <AdminActivityLog t={t} data={data} setData={updateData} addLog={addLog} />;
      case 'dashboard': return <Dashboard t={t} onViewMember={handleViewMember} onViewDeal={handleViewDeal} onViewAnnouncements={(id) => { if (id) sessionStorage.setItem('scrollToAnnouncement', id); setView('announcements'); }} data={data} setData={updateData} userProfile={userProfile} />;
      case 'events': return <EventsView t={t} data={data} setData={updateData} userProfile={userProfile} />;
      case 'portfolio': return <PortfolioView t={t} onViewDeal={handleViewDeal} data={data} />;
      case 'community': return <CommunityView t={t} onViewMember={handleViewMember} data={data} />;
      case 'announcements': return <AnnouncementsView t={t} data={data} />;
      case 'my-portfolio': return <MyPortfolioView t={t} onViewDeal={handleViewDeal} data={data} userProfile={userProfile} />;
      case 'profile': return <ProfileView t={t} userProfile={userProfile} setUserProfile={setUserProfile} setData={updateData} />;
      default: return <Dashboard t={t} onViewMember={handleViewMember} onViewDeal={handleViewDeal} data={data} />;
    }
  };
  
  const getTitle = () => {
    if (viewDeal) return viewDeal.companyName;
    if (viewMember) return viewMember.nameEn || viewMember.name;
    return titles[view] || t.dashboard;
  };
  
  // Show login if not authenticated
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.primary }}>
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  
  const shouldShowMfaCloseTabMessage =
    pendingMfa && sessionStorage.getItem('kizuna_mfa_link_sent') === 'true';

  // Show login if not authenticated OR if we haven't checked password requirement yet
  if (!session || !user || pendingMfa || passwordChangeInProgress || (session && !hasCheckedPasswordRequirement)) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
          <div className="text-center max-w-md">
            <div className="mb-8">
              <div className="text-6xl mb-4">🎌</div>
              <h1 className="text-4xl font-bold mb-2" style={{ color: colors.primary }}>Kizuna Club</h1>
              <p className="text-gray-600">Alumni Ventures Japan Portal</p>
            </div>
            <div className="w-full">
              {shouldShowMfaCloseTabMessage ? (
                <div
                  className="relative overflow-hidden bg-white rounded-2xl max-w-sm w-full p-7 text-center border-2 shadow-lg"
                  style={{ borderColor: `${colors.primary}33` }}
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: colors.primary }} />
                  <h2 className="text-xl font-bold mb-2" style={{ color: colors.primary }}>Magic Link Sent</h2>
                  <p className="text-base font-medium text-gray-700">
                    You may close this tab.
                  </p>
                </div>
              ) : (
                <LoginModal 
                  isOpen={true} 
                  onClose={() => setShowLogin(false)} 
                  t={t} 
                  inline 
                  onPasswordChangeStart={(member) => {
                    setPasswordChangeInProgress(true);
                    setMemberNeedingPasswordChange(member);
                    setHasCheckedPasswordRequirement(true);
                  }}
                  onPasswordChangeComplete={() => {
                    setPasswordChangeInProgress(false);
                    setMemberNeedingPasswordChange(null);
                    setHasCheckedPasswordRequirement(true);
                  }}
                  onLoginSuccess={() => {
                    setHasCheckedPasswordRequirement(true);
                  }}
                  onMfaRequired={(isRequired = true) => {
                    setPendingMfa(isRequired);
                    if (isRequired) setHasCheckedPasswordRequirement(false);
                  }}
                  memberNeedingPasswordChange={memberNeedingPasswordChange}
                  passwordChangeInProgress={passwordChangeInProgress}
                />
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
  
  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.primary }}>
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        currentView={view} 
        setCurrentView={(v) => { setView(v); handleBack(); }} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
        t={t} 
        isAdmin={isAdmin} 
        canBeAdmin={canBeAdmin} 
        onToggleAdmin={handleToggleAdmin} 
        onLogout={handleLogout} 
        userProfile={userProfile} 
      />
      <main className="lg:ml-64">
        <Header title={getTitle()} setIsOpen={setSidebarOpen} />
        <div className="p-4 lg:p-6 pb-24">{renderView()}</div>
      </main>
    </div>
  );
}
