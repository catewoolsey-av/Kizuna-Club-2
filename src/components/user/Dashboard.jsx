import React, { useState, useEffect } from 'react';
import { colors } from "../../constants/theme";
import { Card, Badge, Button, Toast } from "../../components/ui";
import { Calendar, Users, Briefcase, MessageSquare, ChevronRight, CheckCircle, MapPin, Utensils, Mail, Star, Megaphone, X, Clock } from 'lucide-react';
import { formatDateRange } from "../../utils/date";
import { supabase } from "../../lib/supabaseClient";

const SHOW_MEMBER_ACTIVE_SYNDICATIONS = false;

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Helper to get logo URL from storage or return as-is
const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http')) return logoPath; // Already a full URL
  if (logoPath.length <= 4) return logoPath; // Emoji
  
  // It's a storage path, construct the public URL
  const { data } = supabase.storage
    .from('company-logos')
    .getPublicUrl(logoPath);
  
  return data.publicUrl;
};

const convertESTtoJST = (timeStr) => {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(':').map(Number);
  let jstHours = hours + 14;
  if (jstHours >= 24) jstHours -= 24;
  return `${String(jstHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getMaxRowCircles = () => {
  if (typeof window === 'undefined') return 10;
  const width = window.innerWidth;
  if (width >= 1024) return 10;
  if (width >= 768) return 8;
  if (width >= 640) return 6;
  return 4;
};

const getNameLines = (name) => {
  if (!name) return { first: '', last: '' };
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

const Dashboard = ({ t, onViewMember, onViewDeal, onViewCommunity, onViewAnnouncements, data, setData, userProfile }) => {
  const announcementsPublished = (data.announcements || []).filter(a => a.status === 'published');
  const pinnedAnnouncements = announcementsPublished.filter(a => a.pinned);
  const otherAnnouncements = announcementsPublished.filter(a => !a.pinned);
  const announcementToShow = pinnedAnnouncements[0] || otherAnnouncements[0] || null;
  const [toast, setToast] = useState(null);
  const [investModal, setInvestModal] = useState(null);
  const [passModal, setPassModal] = useState(null);
  const [investForm, setInvestForm] = useState({ amountType: 'up_to', amount: '', notes: '' });
  const [passForm, setPassForm] = useState({ notes: '' });
  const [sending, setSending] = useState(false);
  const [changingDinnerRsvp, setChangingDinnerRsvp] = useState(false);
  const [changingDiscussionRsvp, setChangingDiscussionRsvp] = useState(false);
  const [dealInterests, setDealInterests] = useState({});
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [maxRowCircles, setMaxRowCircles] = useState(getMaxRowCircles);

  const getTodayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const isPastEvent = (dateStr) => {
    if (!dateStr) return false;
    const today = getTodayStart();
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  const upcomingDiscussions = (data.discussions || [])
    .filter(d => !isPastEvent(d.date) && d.isUpcoming !== false)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const upDiscussion = upcomingDiscussions[0];
  const upcomingDinners = (data.dinners || [])
    .filter(d => !isPastEvent(d.date) && d.isUpcoming !== false)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const upDinner = upcomingDinners[0];

  const formatMonetary = (value) => {
    if (!value) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return 'N/A';
    
    if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(0)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  useEffect(() => {
    const loadExistingInterests = async () => {
      if (!userProfile) {
        setLoadingInterests(false);
        return;
      }

      try {
        const { data: interests, error } = await supabase
          .from('deal_interests')
          .select('*')
          .eq('member_id', userProfile.id);

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading interests:', error);
        }

        if (interests && interests.length > 0) {
          const interestsMap = {};
          interests.forEach(interest => {
            interestsMap[interest.deal_id] = interest;
          });
          setDealInterests(interestsMap);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoadingInterests(false);
      }
    };

    loadExistingInterests();
  }, [userProfile]);

  useEffect(() => {
    const handleResize = () => setMaxRowCircles(getMaxRowCircles());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const visibleLeadership = (data.leadership || [])
    .filter(l => l.profile_visible !== false)
    .map(l => ({ ...l, nameEn: l.name }));
  const leaders = visibleLeadership.filter(l => !l.show_as_member);
  const memberRoleLeaders = visibleLeadership
    .filter(l => l.show_as_member)
    .map(l => ({ ...l, _isLeader: true }));
  const realMembers = data.members || [];
  const members = [...memberRoleLeaders, ...realMembers];
  const totalPeople = leaders.length + members.length;
  const leadersOverflowCount = leaders.length > maxRowCircles ? leaders.length - (maxRowCircles - 1) : 0;
  const membersOverflowCount = members.length > maxRowCircles ? members.length - (maxRowCircles - 1) : 0;
  const visibleLeaders = leadersOverflowCount > 0 ? leaders.slice(0, maxRowCircles - 1) : leaders.slice(0, maxRowCircles);
  const visibleMembers = membersOverflowCount > 0 ? members.slice(0, maxRowCircles - 1) : members.slice(0, maxRowCircles);
  
  const allPortfolioDeals = data.fundHoldings || [];
  
  const userId = userProfile?.id || 'current-user';
  const isDinnerAttending = upDinner?.attendees?.includes(userId);
  const isDinnerNotAttending = upDinner?.notAttending?.includes(userId);
  const dinnerStatus = isDinnerAttending ? 'attending' : isDinnerNotAttending ? 'not-attending' : null;

  const discussionStatus = upDiscussion
    ? (upDiscussion.rsvpYes?.includes(userProfile?.id) ? 'attending' : upDiscussion.rsvpNo?.includes(userProfile?.id) ? 'not-attending' : null)
    : null;
  
  const handleDinnerRsvp = async (attending) => {
    if (!upDinner) return;
    try {
      const attendees = (upDinner.attendees || []).filter(id => id !== userId);
      const notAttending = (upDinner.notAttending || []).filter(id => id !== userId);
      const notResponded = (upDinner.notResponded || []).filter(id => id !== userId);
      
      const updates = {
        attendees: attending ? [...attendees, userId] : attendees,
        not_attending: attending ? notAttending : [...notAttending, userId],
        not_responded: notResponded,
      };
      
      const { error } = await supabase
        .from('dinners')
        .update(updates)
        .eq('id', upDinner.id);
      
      if (error) throw error;
      
      setData(prev => ({
        ...prev,
        dinners: prev.dinners.map(d => 
          d.id === upDinner.id 
            ? { ...d, attendees: updates.attendees, notAttending: updates.not_attending, notResponded: updates.not_responded }
            : d
        )
      }));
      
      setChangingDinnerRsvp(false);
      setToast({ message: attending ? 'RSVP confirmed!' : 'Marked as not attending', type: 'success' });
    } catch (err) {
      console.error('Error updating RSVP:', err);
      setToast({ message: 'Error updating RSVP: ' + err.message, type: 'error' });
    }
  };

  const handleDiscussionRsvp = async (attending) => {
    if (!upDiscussion || !userProfile) return;
    try {
      const rsvpYes = (upDiscussion.rsvpYes || []).filter(id => id !== userProfile.id);
      const rsvpNo = (upDiscussion.rsvpNo || []).filter(id => id !== userProfile.id);
      const notResponded = (upDiscussion.notResponded || []).filter(id => id !== userProfile.id);

      const updates = {
        rsvp_yes: attending ? [...rsvpYes, userProfile.id] : rsvpYes,
        rsvp_no: attending ? rsvpNo : [...rsvpNo, userProfile.id],
        not_responded: notResponded,
      };

      const { error } = await supabase
        .from('discussions')
        .update(updates)
        .eq('id', upDiscussion.id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        discussions: prev.discussions.map(d =>
          d.id === upDiscussion.id
            ? { ...d, rsvpYes: updates.rsvp_yes, rsvpNo: updates.rsvp_no, notResponded: updates.not_responded }
            : d
        )
      }));

      setChangingDiscussionRsvp(false);
      setToast({ message: attending ? 'Marked as attending' : 'Marked as not attending', type: 'success' });
    } catch (err) {
      console.error('Error updating RSVP:', err);
      setToast({ message: 'Error updating RSVP: ' + err.message, type: 'error' });
    }
  };

  const handleViewCommunity = () => {
    if (onViewCommunity) onViewCommunity();
  };
  
  const handleSyndicationInterest = async (deal, type) => {
    if (!userProfile) {
      setToast({ message: 'Please log in to express interest', type: 'error' });
      return;
    }

    const existingInterest = dealInterests[deal.id];
    const existingType = existingInterest?.interest_type === 'learn_more' ? 'pass' : existingInterest?.interest_type;
    const dealClosed = deal.syndicationStatus === 'past';
    const isContacted = existingInterest?.status === 'contacted' || existingInterest?.status === 'completed';

    if (dealClosed) {
      setToast({ message: 'This deal is closed. You can no longer change your response.', type: 'info' });
      return;
    }

    if (existingInterest) {
      if (type === 'invest' && existingType === 'invest') {
        setToast({ message: 'You already expressed investment interest in this deal', type: 'info' });
        return;
      }
      
      if (type === 'pass' && existingType === 'pass') {
        setToast({ message: 'You already passed on this deal', type: 'info' });
        return;
      }

      if (type === 'pass' && existingType === 'invest' && isContacted) {
        setToast({ message: 'You can no longer switch to pass after being contacted.', type: 'info' });
        return;
      }
    }

    if (type === 'invest') {
      setInvestModal(deal);
      setInvestForm({ amountType: 'up_to', amount: '', notes: '' });
      return;
    }

    if (type === 'pass') {
      setPassModal(deal);
      setPassForm({ notes: '' });
      return;
    }
  };

  const submitInterest = async (deal, interestType, investmentData) => {
    setSending(true);
    
    try {
      const dbInterestType = interestType === 'pass' ? 'learn_more' : interestType;
      const interestData = {
        member_id: userProfile.id,
        member_name: userProfile.name || userProfile.nameEn || userProfile.email,
        member_email: userProfile.email,
        deal_id: deal.id,
        deal_name: deal.companyName,
        interest_type: dbInterestType,
        status: 'pending'
      };

      if (interestType === 'invest' && investmentData) {
        const messageParts = [];
        if (investmentData.amountType === 'max') {
          messageParts.push('Investment Amount: Maximum Available Allocation');
        } else if (investmentData.amount) {
          messageParts.push(`Investment Amount: $${investmentData.amount}`);
        }
        if (investmentData.notes?.trim()) {
          messageParts.push(`Notes: ${investmentData.notes.trim()}`);
        }
        if (messageParts.length > 0) {
          interestData.message = messageParts.join('\n');
        }
      }

      if (interestType === 'pass' && investmentData?.notes?.trim()) {
        interestData.message = `Notes: ${investmentData.notes.trim()}`;
      }

      const existingInterest = dealInterests[deal.id];
      const existingType = existingInterest?.interest_type === 'learn_more' ? 'pass' : existingInterest?.interest_type;

      if (existingInterest && ((interestType === 'invest' && existingType !== 'invest') || interestType === 'pass')) {
        const { error } = await supabase
          .from('deal_interests')
          .update({
            interest_type: dbInterestType,
            message: interestData.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingInterest.id);

        if (error) throw error;

        setDealInterests(prev => ({
          ...prev,
          [deal.id]: {
            ...existingInterest,
            interest_type: dbInterestType,
            message: interestData.message
          }
        }));
      } else {
        const { data: result, error } = await supabase
          .from('deal_interests')
          .insert(interestData)
          .select()
          .single();

        if (error) throw error;

        setDealInterests(prev => ({
          ...prev,
          [deal.id]: result
        }));
      }

      const message = interestType === 'pass'
        ? 'Pass recorded. Club leadership has been notified.'
        : 'Investment interest recorded! Club leadership will reach out with next steps.';
      
      setToast({ message, type: 'success' });
      setInvestModal(null);
      setPassModal(null);
      setInvestForm({ amountType: 'up_to', amount: '', notes: '' });
      setPassForm({ notes: '' });
      
    } catch (err) {
      console.error('Error recording interest:', err);
      setToast({ message: 'Error submitting interest. Please try again.', type: 'error' });
    } finally {
      setSending(false);
    }
  };
  
  const handleInvestSubmit = async () => {
    if (investForm.amountType === 'up_to') {
      if (!investForm.amount) {
        setToast({ message: 'Please enter an investment amount', type: 'error' });
        return;
      }
      const numericAmount = parseInt(investForm.amount.replace(/,/g, ''), 10);
      if (!Number.isFinite(numericAmount) || numericAmount < 25000) {
        setToast({ message: 'Minimum check is 25k', type: 'error' });
        return;
      }
    }
    
    await submitInterest(investModal, 'invest', investForm);
  };

  const handlePassSubmit = async () => {
    await submitInterest(passModal, 'pass', passForm);
  };

  const announcementsCard = (
    <Card className="border-gray-300 h-full">
      <div className="flex items-start gap-3 h-full">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: colors.accentSubtle }}>
          <Megaphone size={20} style={{ color: colors.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-3">Announcements</h3>
          {announcementToShow ? (
            <button
              type="button"
              onClick={() => onViewAnnouncements && onViewAnnouncements(announcementToShow.id)}
              className="text-left w-full -mx-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              {announcementToShow.pinned && (
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="accent">{t.pinned}</Badge>
                </div>
              )}
              <h4 className="font-semibold text-gray-900 mb-1.5">{announcementToShow.title}</h4>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{announcementToShow.content}</p>
              <span className="text-xs text-blue-600 mt-2 inline-block group-hover:underline">Read more</span>
            </button>
          ) : (
            <p className="text-sm text-gray-500">No announcements at this time.</p>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Members Grid */}
      <div className="bg-white rounded-xl p-6 border border-gray-300 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Our Community</h3>
          <span className="text-sm text-gray-600">{totalPeople} members</span>
        </div>
        
        {leaders.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Leadership</p>
            <div className="flex flex-nowrap gap-3 justify-start overflow-hidden w-full">
              {visibleLeaders.map((p, idx) => {
                const { first, last } = getNameLines(p.nameEn || p.name);
                return (
                <button 
                  key={p.id || idx} 
                  onClick={() => onViewMember({ ...p, isManager: true })} 
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-all w-20 flex-none"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                  >
                    {getInitials(p.nameEn || p.name)}
                  </div>
                  <div className="text-[11px] leading-tight text-gray-700 w-full text-center">
                    <span className="block">{first}</span>
                    {last && <span className="block">{last}</span>}
                  </div>
                </button>
                );
              })}
              {leadersOverflowCount > 0 && (
                <button
                  onClick={handleViewCommunity}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-all w-20 flex-none"
                  aria-label={`View ${leadersOverflowCount} more leadership profiles`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-300 text-gray-700">
                    +{leadersOverflowCount}
                  </div>
                  <p className="text-xs text-gray-600 truncate w-full text-center">View all</p>
                </button>
              )}
            </div>
          </div>
        )}
        
        {visibleMembers.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Members</p>
            <div className="flex flex-nowrap gap-3 justify-start overflow-hidden w-full">
              {visibleMembers.map((p, idx) => {
                const { first, last } = getNameLines(p.nameEn || p.name);
                const isLeaderRow = p._isLeader === true;
                return (
                <button
                  key={p.id || idx}
                  onClick={() => onViewMember({ ...p, isAV: false, isManager: isLeaderRow })}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-all w-20 flex-none"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={
                      isLeaderRow
                        ? { backgroundColor: '#FEF3C7', color: '#92400E' }
                        : { backgroundColor: colors.primary, color: '#fff' }
                    }
                  >
                    {getInitials(p.nameEn || p.name)}
                  </div>
                  <div className="text-[11px] leading-tight text-gray-700 w-full text-center">
                    <span className="block">{first}</span>
                    {last && <span className="block">{last}</span>}
                  </div>
                </button>
                );
              })}
              {membersOverflowCount > 0 && (
                <button
                  onClick={handleViewCommunity}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-all w-20 flex-none"
                  aria-label={`View ${membersOverflowCount} more member profiles`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold border border-gray-300 text-gray-700">
                    +{membersOverflowCount}
                  </div>
                  <p className="text-xs text-gray-600 truncate w-full text-center">View all</p>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Top row: [Discussion | Dinner] when a discussion exists, otherwise [Announcements | Dinner] */}
      <div className="grid lg:grid-cols-2 gap-4">
        {upDiscussion ? (
        <Card className="border-gray-300 h-full flex flex-col">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <MessageSquare size={20} className="text-blue-600" />
            </div>
            <div className="ml-1 flex-1 flex flex-col">
              <h3 className="font-semibold text-gray-900">Next Group Discussion</h3>
              <div className="flex-1 flex flex-col justify-center py-2">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">{upDiscussion.title}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />{formatDateRange(upDiscussion.date, upDiscussion.endDate)}
                    </span>
                    {upDiscussion.time && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} />{upDiscussion.time} EST / {convertESTtoJST(upDiscussion.time)} JST
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />{upDiscussion.meetingUrl || upDiscussion.zoomLink || 'Zoom'}
                    </span>
                  </div>
                </div>

                {discussionStatus && !changingDiscussionRsvp ? (
                  <div className="flex items-center gap-2 flex-wrap mt-6">
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
                      discussionStatus === 'attending' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {discussionStatus === 'attending' ? <><CheckCircle size={14} /> You're attending</> : <><X size={14} /> Not attending</>}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setChangingDiscussionRsvp(true)}>
                      Change RSVP
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-6">
                    <Button
                      variant={!discussionStatus ? "outline" : (discussionStatus === 'attending' ? "accent" : "outline")}
                      size="sm"
                      onClick={() => handleDiscussionRsvp(true)}
                      className="flex-1"
                    >
                      {t.attending || 'Attending'}
                    </Button>
                    <Button
                      variant={!discussionStatus ? "outline" : (discussionStatus === 'not-attending' ? "accent" : "outline")}
                      size="sm"
                      onClick={() => handleDiscussionRsvp(false)}
                      className="flex-1"
                    >
                      {t.notAttending || 'Not Attending'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
        ) : (
          announcementsCard
        )}
        <Card className="border-gray-300 h-full flex flex-col">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Utensils size={20} className="text-purple-600" />
            </div>
            <div className="ml-1 flex-1 flex flex-col">
              <h3 className="font-semibold text-gray-900">{t.nextDinner}</h3>
              {upDinner ? (
                <div className="flex-1 flex flex-col justify-center py-2">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">{upDinner.title}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />{formatDateRange(upDinner.date, upDinner.endDate)}
                      </span>
                      {upDinner.time && (
                        <span className="flex items-center gap-1">
                          <Clock size={14} />{upDinner.time} EST / {convertESTtoJST(upDinner.time)} JST
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />{upDinner.venue}
                      </span>
                    </div>
                  </div>

                  <div>
                    {dinnerStatus && !changingDinnerRsvp ? (
                      <div className="flex items-center gap-2 mt-6 flex-wrap">
                        <div className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
                          dinnerStatus === 'attending' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {dinnerStatus === 'attending' ? <><CheckCircle size={14} /> You're attending</> : <><X size={14} /> Not attending</>}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setChangingDinnerRsvp(true)}>
                          Change RSVP
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-6">
                        <Button
                          variant={!dinnerStatus ? "outline" : (dinnerStatus === 'attending' ? "accent" : "outline")}
                          size="sm"
                          onClick={() => handleDinnerRsvp(true)}
                          className="flex-1"
                        >
                          {t.attending || 'Attending'}
                        </Button>
                        <Button
                          variant={!dinnerStatus ? "outline" : (dinnerStatus === 'not-attending' ? "accent" : "outline")}
                          size="sm"
                          onClick={() => handleDinnerRsvp(false)}
                          className="flex-1"
                        >
                          {t.notAttending || 'Not Attending'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center">
                  <p className="text-sm text-gray-500">No upcoming dinners scheduled.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Announcements full width — only when a discussion is in the top row */}
      {upDiscussion && announcementsCard}
      
      {/* Active Syndications (single outer container, up to 2 inner deal cards) */}
      {SHOW_MEMBER_ACTIVE_SYNDICATIONS && (() => {
        const activeSyndications = (data.syndicationDeals || []).filter(d => d.syndicationStatus !== 'past');
        if (activeSyndications.length === 0) return null;

        const dealsToShow = activeSyndications.slice(0, 2);
        const remaining = activeSyndications.length - dealsToShow.length;

        const DealInnerCard = ({ deal }) => {
          const logoUrl = getLogoUrl(deal.logo);
          const hasUploadedLogo = logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'));
          const existingInterest = dealInterests[deal.id];
          const existingType = existingInterest?.interest_type === 'learn_more' ? 'pass' : existingInterest?.interest_type;
          const dealClosed = deal.syndicationStatus === 'past';
          const isContacted = existingInterest?.status === 'contacted' || existingInterest?.status === 'completed';
          const canSwitchToPass = existingType === 'invest' && !isContacted && !dealClosed;
          const canSwitchToInvest = existingType === 'pass' && !dealClosed;

          return (
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 min-w-0" style={{ marginLeft: hasUploadedLogo ? '4px' : '0' }}>
                  {hasUploadedLogo && (
                    <img
                      src={logoUrl}
                      alt={deal.companyName}
                      className="w-10 h-10 object-contain flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1 truncate">{deal.companyName}</h4>
                    <p className="text-sm text-gray-500 truncate">{deal.sector || '\u00A0'}</p>
                  </div>
                </div>

                <Badge variant="accent">{deal.stage}</Badge>
              </div>

              <div className={`space-y-2 mb-3 ${hasUploadedLogo ? "ml-14" : ""}`}>
                <div className="flex items-center gap-2 text-sm min-h-[1.25rem]">
                  {deal.valuation ? (
                    <>
                      <span className="text-gray-500">Valuation:</span>
                      <span className="font-medium text-gray-900">
                        {formatMonetary(deal.valuation)}
                        {deal.isPreMoney === true && <span className="text-xs text-gray-500 ml-1">(pre-money)</span>}
                        {deal.isPreMoney === false && <span className="text-xs text-gray-500 ml-1">(post-money)</span>}
                      </span>
                    </>
                  ) : (
                    <span className="invisible">placeholder</span>
                  )}
                </div>
                {deal.isApproximate && deal.valuation && (
                  <p className="text-[11px] text-gray-500 italic">To be finalized, discussions around {formatMonetary(deal.valuation)} value</p>
                )}
              </div>
              
              {existingInterest && (
                <div className={`mb-3 p-2 bg-white rounded-lg border border-blue-200 ${hasUploadedLogo ? "ml-14" : ""}`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="text-xs font-medium text-gray-900">
                      {(existingType === 'invest') 
                        ? (existingInterest.status === 'completed' ? "You've invested in this deal" : "You've expressed investment interest")
                        : "You've passed on this deal"}
                    </span>
                  </div>
                  {existingType === 'invest' && isContacted && (
                    <p className="text-xs text-gray-600 mt-1 ml-5">
                      You've been contacted about your interest.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                <Button variant="outline" size="sm" icon={ChevronRight} onClick={() => onViewDeal(deal)}>{t.more}</Button>
                <Button 
                  variant={existingType === 'invest' ? 'primary' : 'outline'}
                  size="sm" 
                  icon={CheckCircle} 
                  onClick={() => handleSyndicationInterest(deal, 'invest')} 
                  disabled={loadingInterests || dealClosed || existingType === 'invest'}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {"Invest"}
                </Button>
                <Button 
                  variant={(existingType === 'pass') ? 'primary' : 'outline'}
                  size="sm" 
                  icon={MessageSquare} 
                  onClick={() => handleSyndicationInterest(deal, 'pass')}
                  disabled={loadingInterests || dealClosed || existingType === 'pass' || (existingType === 'invest' && !canSwitchToPass)}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {"Pass"}
                </Button>
              </div>
            </div>
          );
        };

        return (
          <Card className="bg-blue-50/30 border-gray-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star size={20} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900">Active Syndications</h3>
              </div>
              {remaining > 0 && (
                <span className="text-xs text-blue-600 font-medium">+{remaining} more</span>
              )}
            </div>

            <div className={dealsToShow.length === 2 ? "grid lg:grid-cols-2 gap-4" : ""}>
              {dealsToShow.map((deal) => (
                <DealInnerCard key={deal.id} deal={deal} />
              ))}
            </div>
          </Card>
        );
      })()}
      
      {/* Kizuna 1 Portfolio */}
      <Card className="border-gray-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase size={20} className="text-green-600" />
            <h3 className="font-semibold text-gray-900">Portfolio</h3>
          </div>
          <span className="text-sm text-gray-500 mr-2">{allPortfolioDeals.length} companies</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
          {allPortfolioDeals.map(h => {
            const logoUrl = getLogoUrl(h.logo);
            const isImageUrl = logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'));
            // Only show horizontal layout if there's an actual uploaded image, not emoji
            const hasUploadedLogo = isImageUrl;
            
            return (
              <div 
                key={h.id} 
                className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer" 
                onClick={() => onViewDeal(h)}
              >
                {hasUploadedLogo ? (
                  // Layout with uploaded logo - horizontal
                  <div className="flex items-start gap-2">
                    {/* Logo on left */}
                    <div className="flex-shrink-0">
                      <img 
                        src={logoUrl} 
                        alt={h.companyName} 
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    {/* Content on right */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate mb-1">{h.companyName}</p>
                      <p className="text-xs text-gray-500 truncate mb-2">{h.sector}</p>
                      <Badge>{h.stage}</Badge>
                    </div>
                  </div>
                ) : (
                  // Layout without logo - vertical (original)
                  <>
                    <div className="mb-2">
                      <p className="font-medium text-gray-900 text-sm truncate mb-1">{h.companyName}</p>
                      <p className="text-xs text-gray-500 truncate mb-2">{h.sector || '\u00A0'}</p>
                    </div>
                    <div>
                      <Badge>{h.stage}</Badge>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {allPortfolioDeals.length === 0 && <p className="text-center text-gray-400 py-8">{t.noResults}</p>}
      </Card>
      
      {/* Investment Interest Modal */}
      {investModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setInvestModal(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Investment Interest</h2>
              <button onClick={() => setInvestModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              You're expressing interest to invest in <span className="font-semibold">{investModal.companyName}</span>. We will follow up with you to discuss next steps.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 mb-4">
              <span className="font-semibold">Note:</span> Allocation is not guaranteed. Depending on demand and allocation policy, you may receive less than your requested amount; this is a requested reservation only.
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900">Investment Amount *</label>
              <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${investForm.amountType === 'up_to' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="investment-amount-type"
                  value="up_to"
                  checked={investForm.amountType === 'up_to'}
                  onChange={() => setInvestForm(f => ({ ...f, amountType: 'up_to' }))}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Up To $</p>
                  <input
                    type="text"
                    value={investForm.amount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d,]/g, '');
                      setInvestForm(f => ({ ...f, amount: value }));
                    }}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    placeholder="e.g., 50000"
                    disabled={investForm.amountType !== 'up_to'}
                  />
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${investForm.amountType === 'max' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="investment-amount-type"
                  value="max"
                  checked={investForm.amountType === 'max'}
                  onChange={() => setInvestForm(f => ({ ...f, amountType: 'max' }))}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900">Maximum Available Allocation</p>
                  <p className="text-sm text-gray-500">Request the maximum amount available</p>
                </div>
              </label>

              <p className="text-sm text-gray-500">Minimum check: 25k</p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-900 mb-1">Notes (optional)</label>
              <textarea
                value={investForm.notes}
                onChange={(e) => setInvestForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add any notes here..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setInvestModal(null)} disabled={sending}>Cancel</Button>
              <Button variant="primary" onClick={handleInvestSubmit} disabled={sending}>
                {sending ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pass Modal */}
      {passModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPassModal(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Pass on Deal</h2>
              <button onClick={() => setPassModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              You're passing on <span className="font-semibold">{passModal.companyName}</span>.
            </p>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Notes (optional)</label>
              <textarea
                value={passForm.notes}
                onChange={(e) => setPassForm({ notes: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Not in my investment thesis, valuation concerns, etc."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setPassModal(null)} disabled={sending}>Cancel</Button>
              <Button variant="primary" onClick={handlePassSubmit} disabled={sending}>
                {sending ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Dashboard;
