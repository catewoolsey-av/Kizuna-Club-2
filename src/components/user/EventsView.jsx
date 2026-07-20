import React, { useState } from 'react';
import { supabase } from "../../lib/supabaseClient";
import { colors } from "../../constants/theme";
import { Card, Badge, Button, Toast } from "../../components/ui";
import { Calendar, Clock, Users, MessageSquare, Utensils, CheckCircle, X, ExternalLink, MapPin, CalendarPlus, User } from 'lucide-react';
import { formatDateRange } from "../../utils/date";

const EventsView = ({ t, data, setData, userProfile }) => {
  const [toast, setToast] = useState(null);
  const [changingRsvp, setChangingRsvp] = useState({});
  const userId = userProfile?.id || 'current-user';

  // ✅ NEW: Past detection by comparing event date to today (date-only)
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

  // ✅ UPDATED: Only show non-past events on member side
  const upcomingDiscussions = data.discussions.filter(d => !isPastEvent(d.date) && d.isUpcoming !== false);
  const upcomingDinners = data.dinners.filter(d => !isPastEvent(d.date) && d.isUpcoming !== false);

  const convertESTtoJST = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':').map(Number);
    let jstHours = hours + 14;
    if (jstHours >= 24) jstHours -= 24;
    return `${String(jstHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const getRsvpStatus = (event) => {
    if (event.rsvpYes?.includes(userId)) return 'attending';
    if (event.rsvpNo?.includes(userId)) return 'not-attending';
    return null;
  };

  const handleDiscussionRsvp = async (discussion, attending) => {
    try {
      const rsvpYes = (discussion.rsvpYes || []).filter(id => id !== userId);
      const rsvpNo = (discussion.rsvpNo || []).filter(id => id !== userId);
      const notResponded = (discussion.notResponded || []).filter(id => id !== userId);

      const updates = {
        rsvp_yes: attending ? [...rsvpYes, userId] : rsvpYes,
        rsvp_no: attending ? rsvpNo : [...rsvpNo, userId],
        not_responded: notResponded,
      };

      const { error } = await supabase
        .from('discussions')
        .update(updates)
        .eq('id', discussion.id);

      if (error) throw error;

      setData(p => ({
        ...p,
        discussions: p.discussions.map(d => {
          if (d.id !== discussion.id) return d;
          return {
            ...d,
            rsvpYes: updates.rsvp_yes,
            rsvpNo: updates.rsvp_no,
            notResponded: updates.not_responded
          };
        })
      }));

      setChangingRsvp(prev => ({ ...prev, [discussion.id]: false }));
      setToast({ message: attending ? 'Marked as attending' : 'Marked as not attending', type: 'success' });
    } catch (err) {
      console.error('Error updating RSVP:', err);
      setToast({ message: 'Error updating RSVP: ' + err.message, type: 'error' });
    }
  };

  const handleDinnerRsvp = async (dinner, attending) => {
    try {
      const attendees = (dinner.attendees || []).filter(id => id !== userId);
      const notAttending = (dinner.notAttending || []).filter(id => id !== userId);
      const notResponded = (dinner.notResponded || []).filter(id => id !== userId);

      const updates = {
        attendees: attending ? [...attendees, userId] : attendees,
        not_attending: attending ? notAttending : [...notAttending, userId],
        not_responded: notResponded,
      };

      const { error } = await supabase
        .from('dinners')
        .update(updates)
        .eq('id', dinner.id);

      if (error) throw error;

      setData(p => ({
        ...p,
        dinners: p.dinners.map(d => {
          if (d.id !== dinner.id) return d;
          return {
            ...d,
            attendees: updates.attendees,
            notAttending: updates.not_attending,
            notResponded: updates.not_responded
          };
        })
      }));

      setChangingRsvp(prev => ({ ...prev, [dinner.id]: false }));
      setToast({ message: attending ? 'RSVP: Attending' : 'RSVP: Not attending', type: 'success' });
    } catch (err) {
      console.error('Error updating RSVP:', err);
      setToast({ message: 'Error updating RSVP: ' + err.message, type: 'error' });
    }
  };

  const getGoogleCalendarUrl = (event, isDiscussion) => {
    const title = encodeURIComponent(event.title);
    const date = event.date.replace(/-/g, '');
    const time = (event.time || '18:30').replace(':', '') + '00';
    const endTime = String(parseInt(time.slice(0, 2)) + 2).padStart(2, '0') + time.slice(2);
    const location = encodeURIComponent(isDiscussion ? 'Zoom (link to follow)' : (event.venue || ''));
    const details = encodeURIComponent(event.description || `Kizuna Club ${isDiscussion ? 'Discussion' : 'Dinner'}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}T${time}/${date}T${endTime}&location=${location}&details=${details}&ctz=Asia/Tokyo`;
  };

  const getAppleCalendarUrl = (event, isDiscussion) => {
    const title = encodeURIComponent(event.title);
    const date = event.date;
    const time = event.time || '18:30';
    const location = encodeURIComponent(isDiscussion ? 'Zoom' : (event.venue || ''));
    return `data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ADTSTART:${date.replace(/-/g, '')}T${time.replace(':', '')}00%0ADTEND:${date.replace(/-/g, '')}T${String(parseInt(time.slice(0, 2)) + 2).padStart(2, '0')}${time.slice(3)}00%0ASUMMARY:${title}%0ALOCATION:${location}%0AEND:VEVENT%0AEND:VCALENDAR`;
  };

  const CalendarDropdown = ({ event, isDiscussion }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative">
        <Button variant="outline" size="sm" icon={CalendarPlus} onClick={() => setOpen(!open)}>
          Add to Calendar
        </Button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
              <a
                href={getGoogleCalendarUrl(event, isDiscussion)}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Google Calendar
              </a>
              <a
                href={getAppleCalendarUrl(event, isDiscussion)}
                download={`${event.title}.ics`}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Apple Calendar
              </a>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {upcomingDiscussions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-blue-600" />
            Group Discussions
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {upcomingDiscussions.map(d => {
              const status = getRsvpStatus(d);
              const isChanging = changingRsvp[d.id];
              return (
                <Card key={d.id}>
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="accent">{d.topic}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{d.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{d.description}</p>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={16} className="text-gray-400" />{formatDateRange(d.date, d.endDate)}
                    </div>
                    {d.time && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={16} className="text-gray-400" />{d.time} EST / {convertESTtoJST(d.time)} JST
                      </div>
                    )}
                    {d.host && (
                      <div className="flex items-center gap-2 text-sm">
                        <User size={16} className="text-gray-400" />{d.host}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Users size={16} className="text-gray-400" />{d.rsvpYes?.length || 0} attending
                    </div>
                  </div>

                  {status && !isChanging ? (
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <div className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${status === 'attending' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {status === 'attending' ? <><CheckCircle size={14} /> Attending</> : <><X size={14} /> Not Attending</>}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChangingRsvp(prev => ({ ...prev, [d.id]: true }))}
                      >
                        Change RSVP
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        variant={!status ? "outline" : (status === 'attending' ? "accent" : "outline")}
                        className="flex-1"
                        icon={CheckCircle}
                        onClick={() => handleDiscussionRsvp(d, true)}
                      >
                        Attending
                      </Button>
                      <Button
                        variant={!status ? "outline" : (status === 'not-attending' ? "accent" : "outline")}
                        className="flex-1"
                        icon={X}
                        onClick={() => handleDiscussionRsvp(d, false)}
                      >
                        Not Attending
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <CalendarDropdown event={d} isDiscussion={true} />
                    {d.meetingUrl ? (
                      <Button variant="primary" size="sm" icon={ExternalLink} onClick={() => window.open(d.meetingUrl, '_blank')}>{t.joinZoom}</Button>
                    ) : (
                      <Button variant="outline" size="sm" icon={ExternalLink} disabled className="opacity-50 cursor-not-allowed" title="Meeting link not yet available">Link pending</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {upcomingDinners.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Utensils size={20} className="text-gray-900" />
            Tokyo Dinners
          </h2>
          <p className="text-gray-600 mb-4">{t.exclusiveGathering}</p>
          <div className="grid md:grid-cols-2 gap-6">
            {upcomingDinners.map(d => {
              const isAttending = d.attendees?.includes(userId);
              const isNotAttending = d.notAttending?.includes(userId);
              const status = isAttending ? 'attending' : isNotAttending ? 'not-attending' : null;
              const isChanging = changingRsvp[d.id];
              return (
                <Card key={d.id} padding={false}>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{d.title}</h3>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar size={16} className="text-gray-400" />{formatDateRange(d.date, d.endDate)}
                      </div>
                      {d.time && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock size={16} className="text-gray-400" />{d.time} EST / {convertESTtoJST(d.time)} JST
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin size={16} className="text-gray-400" />{d.venue}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users size={16} className="text-gray-400" />{d.attendees?.length || 0}/{d.capacity} attending
                      </div>
                    </div>

                    {status && !isChanging ? (
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <div className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${status === 'attending' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {status === 'attending' ? <><CheckCircle size={14} /> You're attending</> : <><X size={14} /> Not attending</>}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChangingRsvp(prev => ({ ...prev, [d.id]: true }))}
                        >
                          Change RSVP
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={!status ? "outline" : (status === 'attending' ? "accent" : "outline")}
                          className="flex-1"
                          icon={CheckCircle}
                          onClick={() => handleDinnerRsvp(d, true)}
                        >
                          {t.attending}
                        </Button>
                        <Button
                          variant={!status ? "outline" : (status === 'not-attending' ? "accent" : "outline")}
                          className="flex-1"
                          icon={X}
                          onClick={() => handleDinnerRsvp(d, false)}
                        >
                          {t.notAttending}
                        </Button>
                      </div>
                    )}
                    <div className="mt-3">
                      <CalendarDropdown event={d} isDiscussion={false} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {upcomingDiscussions.length === 0 && upcomingDinners.length === 0 && (
        <Card>
          <p className="text-gray-500 text-center py-8">No upcoming events scheduled</p>
        </Card>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default EventsView;
