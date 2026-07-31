// AdminEvents.jsx - Fixed per requirements
import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Card, Badge, Button, Input, TextArea, Select, Modal, ConfirmModal, Toast, EmailPreviewModal } from "../../components/ui";
import { colors } from "../../constants/theme";
import { formatDate, formatDateRange, getTimeUntil } from "../../utils/date";
import { Plus, Eye, Trash2, MapPin, Users, Edit, MessageSquare, CheckCircle, Clock, Utensils, User } from "lucide-react";

const AdminEvents = ({ t, data, setData, addLog }) => {
  const [showAddDinner, setShowAddDinner] = useState(false);
  const [showAddDiscussion, setShowAddDiscussion] = useState(false);
  const [showEditDinner, setShowEditDinner] = useState(false);
  const [showEditDiscussion, setShowEditDiscussion] = useState(false);
  const [showAtt, setShowAtt] = useState(false);
  const [showRsvp, setShowRsvp] = useState(false);
  const [showDelDinner, setShowDelDinner] = useState(false);
  const [showDelDiscussion, setShowDelDiscussion] = useState(false);
  const [selDinner, setSelDinner] = useState(null);
  const [selDiscussion, setSelDiscussion] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [loading, setLoading] = useState(false);

  // Toggle between Active/Past for each admin events section
  const [discussionView, setDiscussionView] = useState("active"); // "active" | "past"
  const [dinnerView, setDinnerView] = useState("active"); // "active" | "past"

  // Past detection by comparing event date to "today"
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

  // Group discussions "Upcoming" badge only if within next 2 weeks
  const isWithinNextTwoWeeks = (dateStr) => {
    if (!dateStr) return false;
    const today = getTodayStart();
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);

    const end = new Date(today);
    end.setDate(end.getDate() + 14);

    return eventDate >= today && eventDate <= end;
  };

  const [dinnerForm, setDinnerForm] = useState({
    title: "", date: "", endDate: "", time: "18:30", timeJST: "08:30", venue: ""
  });

  const [discussionForm, setDiscussionForm] = useState({
    title: "", description: "", date: "", endDate: "", time: "19:00", timeJST: "09:00",
    timezone: "JST", topic: "", host: "Mike Collins", meetingUrl: "",
  });

  const convertESTtoJST = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":").map(Number);
    let jstHours = hours + 14;
    if (jstHours >= 24) jstHours -= 24;
    return `${String(jstHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const convertJSTtoEST = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":").map(Number);
    let estHours = hours - 14;
    if (estHours < 0) estHours += 24;
    return `${String(estHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const resetDinner = () =>
    setDinnerForm({ title: "", date: "", endDate: "", time: "18:30", timeJST: "08:30", venue: "" });
  const resetDiscussion = () =>
    setDiscussionForm({
      title: "",
      description: "",
      date: "",
      endDate: "",
      time: "19:00",
      timeJST: "09:00",
      timezone: "JST",
      topic: "",
      host: "Mike Collins",
      meetingUrl: "",
    });

  const getAllMemberIds = () => {
    const memberIds = (data.members || []).map((m) => m.id);
    const leaderIds = (data.leadership || []).map((l) => l.id);
    return Array.from(new Set([...leaderIds, ...memberIds]));
  };

  const normalizeIds = (ids, rosterSet) => Array.from(new Set((ids || []).filter((id) => rosterSet.has(id))));

  const getDiscussionRsvp = (discussion) => {
    const rosterIds = getAllMemberIds();
    const rosterSet = new Set(rosterIds);
    const yes = normalizeIds(discussion?.rsvpYes, rosterSet);
    const no = normalizeIds(discussion?.rsvpNo, rosterSet);
    const responded = new Set([...yes, ...no]);
    const notResponded = rosterIds.filter((id) => !responded.has(id));
    return { yes, no, notResponded };
  };

  const getDinnerRsvp = (dinner) => {
    const rosterIds = getAllMemberIds();
    const rosterSet = new Set(rosterIds);
    const attending = normalizeIds(dinner?.attendees, rosterSet);
    const notAttending = normalizeIds(dinner?.notAttending, rosterSet);
    const responded = new Set([...attending, ...notAttending]);
    const notResponded = rosterIds.filter((id) => !responded.has(id));
    return { attending, notAttending, notResponded };
  };

  const handleAddDiscussion = async () => {
    if (!discussionForm.title || !discussionForm.date) return;
    setLoading(true);

    try {
      const allMemberIds = getAllMemberIds();

      const newD = {
        title: discussionForm.title,
        description: discussionForm.description,
        date: discussionForm.date,
        end_date: discussionForm.endDate || null,
        time: discussionForm.time,
        timezone: discussionForm.timezone || "JST",
        host: discussionForm.host,
        topic: discussionForm.topic,
        meeting_url: discussionForm.meetingUrl,
        is_upcoming: true,
        rsvp_yes: [],
        rsvp_no: [],
        not_responded: allMemberIds,
      };

      const { data: inserted, error } = await supabase.from("discussions").insert(newD).select().single();
      if (error) throw error;

      const mapped = {
        ...inserted,
        meetingUrl: inserted.meeting_url,
        isUpcoming: inserted.is_upcoming,
        rsvpYes: inserted.rsvp_yes,
        rsvpNo: inserted.rsvp_no,
        notResponded: inserted.not_responded,
      };

      setData((p) => ({ ...p, discussions: [...p.discussions, mapped] }));
      addLog("discussionAdded", `Added discussion: ${discussionForm.title}`);
      setPendingEmail({
        type: "event",
        title: discussionForm.title,
        summary: `${discussionForm.date} at ${discussionForm.time} ET${discussionForm.topic ? `\nTopic: ${discussionForm.topic}` : ""}`,
        actionUrl: window.location.origin,
      });
      setShowAddDiscussion(false);
      resetDiscussion();
      setToast({ message: "Discussion added", type: "success" });
    } catch (err) {
      console.error("Error:", err);
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditDiscussion = async () => {
    if (!discussionForm.title || !discussionForm.date) return;
    setLoading(true);

    try {
      const updates = {
        title: discussionForm.title,
        description: discussionForm.description,
        date: discussionForm.date,
        end_date: discussionForm.endDate || null,
        time: discussionForm.time,
        timezone: discussionForm.timezone,
        host: discussionForm.host,
        topic: discussionForm.topic,
        meeting_url: discussionForm.meetingUrl,
      };

      const { error } = await supabase.from("discussions").update(updates).eq("id", selDiscussion.id);
      if (error) throw error;

      const mapped = {
        meetingUrl: updates.meeting_url,
        endDate: updates.end_date,
      };

      setData((p) => ({
        ...p,
        discussions: p.discussions.map((d) => (d.id === selDiscussion.id ? { ...d, ...updates, ...mapped } : d)),
      }));
      addLog("discussionEdited", `Edited discussion: ${discussionForm.title}`);
      setShowEditDiscussion(false);
      setSelDiscussion(null);
      resetDiscussion();
      setToast({ message: "Discussion updated", type: "success" });
    } catch (err) {
      console.error("Error:", err);
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelDiscussion = async () => {
    setLoading(true);

    try {
      const { error } = await supabase.from("discussions").delete().eq("id", selDiscussion.id);
      if (error) throw error;

      setData((p) => ({ ...p, discussions: p.discussions.filter((d) => d.id !== selDiscussion.id) }));
      addLog("discussionDeleted", `Deleted discussion: ${selDiscussion.title}`);
      setShowDelDiscussion(false);
      setSelDiscussion(null);
      setToast({ message: "Discussion deleted", type: "success" });
    } catch (err) {
      console.error("Error:", err);
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDinner = async () => {
    if (!dinnerForm.title || !dinnerForm.date || !dinnerForm.venue) return;
    setLoading(true);

    try {
      const allMemberIds = getAllMemberIds();

      const newD = {
        title: dinnerForm.title,
        date: dinnerForm.date,
        end_date: dinnerForm.endDate || null,
        time: dinnerForm.time || "18:30",
        venue: dinnerForm.venue,
        capacity: allMemberIds.length,
        attendees: [],
        not_attending: [],
        not_responded: allMemberIds,
        is_upcoming: true,
      };

      const { data: inserted, error } = await supabase.from("dinners").insert(newD).select().single();
      if (error) throw error;

      const mapped = {
        ...inserted,
        notAttending: inserted.not_attending,
        notResponded: inserted.not_responded,
        isUpcoming: inserted.is_upcoming,
        endDate: inserted.end_date,
      };

      setData((p) => ({ ...p, dinners: [...p.dinners, mapped] }));
      addLog("eventCreated", `Created event: ${dinnerForm.title}`);
      setPendingEmail({
        type: "event",
        title: dinnerForm.title,
        summary: `${dinnerForm.date} at ${dinnerForm.time || "18:30"} ET\nVenue: ${dinnerForm.venue}`,
        actionUrl: window.location.origin,
      });
      setShowAddDinner(false);
      resetDinner();
      setToast({ message: t.savedSuccessfully, type: "success" });
    } catch (err) {
      console.error("Error adding dinner:", err);
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditDinner = async () => {
    if (!dinnerForm.title || !dinnerForm.date || !dinnerForm.venue) return;
    setLoading(true);

    try {
      const updates = {
        title: dinnerForm.title,
        date: dinnerForm.date,
        end_date: dinnerForm.endDate || null,
        time: dinnerForm.time || "18:30",
        venue: dinnerForm.venue,
      };

      const { error } = await supabase.from("dinners").update(updates).eq("id", selDinner.id);
      if (error) throw error;

      setData((p) => ({
        ...p,
        dinners: p.dinners.map((d) =>
          d.id === selDinner.id ? { ...d, ...updates, endDate: updates.end_date } : d
        ),
      }));

      addLog("eventEdited", `Edited event: ${dinnerForm.title}`);
      setShowEditDinner(false);
      setSelDinner(null);
      resetDinner();
      setToast({ message: "Event updated", type: "success" });
    } catch (err) {
      console.error("Error updating dinner:", err);
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelDinner = async () => {
    setLoading(true);

    try {
      const { error } = await supabase.from("dinners").delete().eq("id", selDinner.id);
      if (error) throw error;

      setData((p) => ({ ...p, dinners: p.dinners.filter((e) => e.id !== selDinner.id) }));
      addLog("eventDeleted", `Deleted event: ${selDinner.title}`);
      setSelDinner(null);
      setShowDelDinner(false);
      setToast({ message: t.deletedSuccessfully, type: "success" });
    } catch (err) {
      console.error("Error deleting dinner:", err);
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openEditDinner = (e) => {
    setSelDinner(e);
    const estTime = e.time || "18:30";
    setDinnerForm({
      title: e.title,
      date: e.date,
      endDate: e.endDate || e.end_date || "",
      time: estTime,
      timeJST: convertESTtoJST(estTime),
      venue: e.venue || "",
    });
    setShowEditDinner(true);
  };

  const openEditDiscussion = (d) => {
    setSelDiscussion(d);
    const estTime = d.time || "19:00";
    setDiscussionForm({
      title: d.title,
      description: d.description || "",
      date: d.date,
      endDate: d.endDate || d.end_date || "",
      time: estTime,
      timeJST: convertESTtoJST(estTime),
      timezone: d.timezone || "JST",
      topic: d.topic || "",
      host: d.host,
      meetingUrl: d.meetingUrl || "",
    });
    setShowEditDiscussion(true);
  };

  const avTeam = data.leadership || [];

  // filtered lists for Active vs Past (based on date only)
  const discussionsFiltered = (data.discussions || []).filter((d) => {
    const past = isPastEvent(d.date);
    return discussionView === "past" ? past : !past;
  }).sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return discussionView === "past" ? bTime - aTime : aTime - bTime;
  });

  const dinnersFiltered = (data.dinners || []).filter((e) => {
    const past = isPastEvent(e.date);
    return dinnerView === "past" ? past : !past;
  }).sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return dinnerView === "past" ? bTime - aTime : aTime - bTime;
  });

  return (
    <div className="space-y-8">
      {/* Tokyo Dinners */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Utensils size={20} className="text-gray-900" />
            Tokyo Dinners
          </h2>

          <Button variant="primary" icon={Plus} onClick={() => { resetDinner(); setShowAddDinner(true); }}>
            {t.addEvent}
          </Button>
        </div>

        {/* ✅ MOVED: Toggle directly below the header (per request) */}
        <div className="flex items-center gap-2">
          <Button
            variant={dinnerView === "active" ? "primary" : "outline"}
            size="sm"
            onClick={() => setDinnerView("active")}
          >
            Active
          </Button>
          <Button
            variant={dinnerView === "past" ? "primary" : "outline"}
            size="sm"
            onClick={() => setDinnerView("past")}
          >
            Past
          </Button>
        </div>

        {dinnersFiltered.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-8">
              {dinnerView === "past" ? "No past dinners" : t.noResults}
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {dinnersFiltered.map((e) => {
              const past = isPastEvent(e.date);
              const future = !past;
              const rsvp = getDinnerRsvp(e);

              return (
                <Card key={e.id}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{e.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDateRange(e.date, e.endDate || e.end_date)} · {e.time} EST / {convertESTtoJST(e.time)} JST
                      </p>
                    </div>

                    <Badge variant={future ? "primary" : "default"}>
                      {future ? getTimeUntil(e.date, t) : t.past}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={14} className="text-gray-400" />
                      {e.venue}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                    <div className="p-2 bg-emerald-50 rounded">
                      <span className="block font-semibold text-emerald-600">{rsvp.attending.length}</span>
                      {t.attending}
                    </div>
                    <div className="p-2 bg-red-50 rounded">
                      <span className="block font-semibold text-red-600">{rsvp.notAttending.length}</span>
                      {t.notAttending}
                    </div>
                    <div className="p-2 bg-amber-50 rounded">
                      <span className="block font-semibold text-amber-600">{rsvp.notResponded.length}</span>
                      {t.notResponded}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Eye}
                      className="flex-1"
                      onClick={() => { setSelDinner(e); setShowAtt(true); }}
                    >
                      {t.attendeeList}
                    </Button>

                    <Button variant="ghost" size="sm" icon={Edit} className="text-blue-600" onClick={() => openEditDinner(e)} />
                    <Button variant="ghost" size="sm" icon={Trash2} className="text-red-500" onClick={() => { setSelDinner(e); setShowDelDinner(true); }} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Group Discussions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Group Discussions</h2>
          </div>

          <Button variant="primary" icon={Plus} onClick={() => { resetDiscussion(); setShowAddDiscussion(true); }}>
            Add Discussion
          </Button>
        </div>

        {/* ✅ MOVED: Toggle directly below the header (per request) */}
        <div className="flex items-center gap-2">
          <Button
            variant={discussionView === "active" ? "primary" : "outline"}
            size="sm"
            onClick={() => setDiscussionView("active")}
          >
            Active
          </Button>
          <Button
            variant={discussionView === "past" ? "primary" : "outline"}
            size="sm"
            onClick={() => setDiscussionView("past")}
          >
            Past
          </Button>
        </div>

        {discussionsFiltered.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-8">
              {discussionView === "past" ? "No past discussions" : "No active discussions"}
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {discussionsFiltered.map((d) => {
              const past = isPastEvent(d.date);
              const future = !past;
              const rsvp = getDiscussionRsvp(d);

              return (
                <Card key={d.id}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{d.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDateRange(d.date, d.endDate || d.end_date)} · {d.time} EST / {convertESTtoJST(d.time)} JST
                      </p>
                    </div>

                    <Badge variant={future ? "primary" : "default"}>
                      {future ? getTimeUntil(d.date, t) : t.past}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    {d.host && (
                      <div className="flex items-center gap-2 text-sm">
                        <User size={14} className="text-gray-400" />
                        {d.host}
                      </div>
                    )}
                    {d.topic && (
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquare size={14} className="text-gray-400" />
                        {d.topic}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                    <div className="p-2 bg-emerald-50 rounded">
                      <span className="block font-semibold text-emerald-600">{rsvp.yes.length}</span>
                      {t.attending}
                    </div>
                    <div className="p-2 bg-red-50 rounded">
                      <span className="block font-semibold text-red-600">{rsvp.no.length}</span>
                      {t.notAttending}
                    </div>
                    <div className="p-2 bg-amber-50 rounded">
                      <span className="block font-semibold text-amber-600">{rsvp.notResponded.length}</span>
                      {t.notResponded}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Eye}
                      className="flex-1"
                      onClick={() => { setSelDiscussion(d); setShowRsvp(true); }}
                    >
                      View RSVPs
                    </Button>
                    <Button variant="ghost" size="sm" icon={Edit} className="text-blue-600" onClick={() => openEditDiscussion(d)} />
                    <Button variant="ghost" size="sm" icon={Trash2} className="text-red-500" onClick={() => { setSelDiscussion(d); setShowDelDiscussion(true); }} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={showRsvp} onClose={() => { setShowRsvp(false); setSelDiscussion(null); }} title="RSVP List">
        {selDiscussion && (
          (() => {
            const rsvp = getDiscussionRsvp(selDiscussion);
            return (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">{selDiscussion.title}</h3>
            <div>
              <p className="text-sm font-medium text-emerald-600 mb-2">
                {t.attending} ({rsvp.yes.length})
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Leadership</p>
                  <div className="space-y-2">
                    {rsvp.yes.map((id) => {
                      const leader = data.leadership?.find((x) => x.id === id);
                      return leader ? (
                        <div key={id} className="flex items-center gap-2 text-sm p-2 bg-emerald-50 rounded">
                          <CheckCircle size={14} className="text-emerald-500" />
                          <span>{leader.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Members</p>
                  <div className="space-y-2">
                    {rsvp.yes.map((id) => {
                      const m = data.members.find((x) => x.id === id);
                      return m ? (
                        <div key={id} className="flex items-center gap-2 text-sm p-2 bg-emerald-50 rounded">
                          <CheckCircle size={14} className="text-emerald-500" />
                          <span>{m.nameEn || m.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                {rsvp.yes.length === 0 && <p className="text-sm text-gray-400">None yet</p>}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-red-600 mb-2">
                {t.notAttending} ({rsvp.no.length})
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Leadership</p>
                  <div className="space-y-2">
                    {rsvp.no.map((id) => {
                      const leader = data.leadership?.find((x) => x.id === id);
                      return leader ? (
                        <div key={id} className="flex items-center gap-2 text-sm p-2 bg-red-50 rounded">
                          <span>{leader.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Members</p>
                  <div className="space-y-2">
                    {rsvp.no.map((id) => {
                      const m = data.members.find((x) => x.id === id);
                      return m ? (
                        <div key={id} className="flex items-center gap-2 text-sm p-2 bg-red-50 rounded">
                          <span>{m.nameEn || m.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-600 mb-2">
                {t.notResponded} ({rsvp.notResponded.length})
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Leadership</p>
                  <div className="space-y-2">
                    {rsvp.notResponded.map((id) => {
                      const leader = data.leadership?.find((x) => x.id === id);
                      return leader ? (
                        <div key={id} className="flex items-center gap-2 text-sm p-2 bg-amber-50 rounded">
                          <Clock size={14} className="text-amber-500" />
                          <span>{leader.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Members</p>
                  <div className="space-y-2">
                    {rsvp.notResponded.map((id) => {
                      const m = data.members.find((x) => x.id === id);
                      return m ? (
                        <div key={id} className="flex items-center gap-2 text-sm p-2 bg-amber-50 rounded">
                          <Clock size={14} className="text-amber-500" />
                          <span>{m.nameEn || m.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
            );
          })()
        )}
      </Modal>

      <Modal isOpen={showAtt} onClose={() => { setShowAtt(false); setSelDinner(null); }} title={t.attendeeList}>
        {selDinner && (
          (() => {
            const rsvp = getDinnerRsvp(selDinner);
            return (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">{selDinner.title}</h3>
            <div>
              <p className="text-sm font-medium text-emerald-600 mb-2">
                {t.attending} ({rsvp.attending.length})
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Leadership</p>
                  <div className="space-y-2">
                    {rsvp.attending.map((id) => {
                      const leader = data.leadership?.find((x) => x.id === id);
                      return leader ? (
                        <div key={id} className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                          <span className="text-sm">{leader.name}</span>
                          <span className="text-xs text-gray-500">Alumni Ventures</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Members</p>
                  <div className="space-y-2">
                    {rsvp.attending.map((id) => {
                      const m = data.members.find((x) => x.id === id);
                      return m ? (
                        <div key={id} className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                          <span className="text-sm">{m.nameEn}</span>
                          <span className="text-xs text-gray-500">{m.company}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                {rsvp.attending.length === 0 && <p className="text-sm text-gray-400">None yet</p>}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-600 mb-2">
                {t.notResponded} ({rsvp.notResponded.length})
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Leadership</p>
                  <div className="space-y-2">
                    {rsvp.notResponded.map((id) => {
                      const leader = data.leadership?.find((x) => x.id === id);
                      return leader ? (
                        <div key={id} className="flex items-center justify-between p-2 bg-amber-50 rounded">
                          <span className="text-sm">{leader.name}</span>
                          <span className="text-xs text-gray-500">Alumni Ventures</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Members</p>
                  <div className="space-y-2">
                    {rsvp.notResponded.map((id) => {
                      const m = data.members.find((x) => x.id === id);
                      return m ? (
                        <div key={id} className="flex items-center justify-between p-2 bg-amber-50 rounded">
                          <span className="text-sm">{m.nameEn}</span>
                          <span className="text-xs text-gray-500">{m.company}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
            );
          })()
        )}
      </Modal>

      <Modal isOpen={showAddDiscussion} onClose={() => setShowAddDiscussion(false)} title="Add Discussion" size="lg" closeOnBackdrop={false}>
        <div className="space-y-4">
          <Input label="Title" value={discussionForm.title} onChange={(v) => setDiscussionForm({ ...discussionForm, title: v })} required />
          <TextArea label="Description" value={discussionForm.description} onChange={(v) => setDiscussionForm({ ...discussionForm, description: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={discussionForm.date} onChange={(v) => setDiscussionForm({ ...discussionForm, date: v })} required />
            <Input label="End Date (optional)" type="date" value={discussionForm.endDate} onChange={(v) => setDiscussionForm({ ...discussionForm, endDate: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Time (US Eastern)" type="time" value={discussionForm.time} onChange={(v) => { const jstTime = convertESTtoJST(v); setDiscussionForm({ ...discussionForm, time: v, timeJST: jstTime }); }} required />
            <Input label="Time (Japan JST)" type="time" value={discussionForm.timeJST} onChange={(v) => { const estTime = convertJSTtoEST(v); setDiscussionForm({ ...discussionForm, timeJST: v, time: estTime }); }} />
          </div>
          <Input label="Topic" value={discussionForm.topic} onChange={(v) => setDiscussionForm({ ...discussionForm, topic: v })} />
          <Select label="Host" value={discussionForm.host} onChange={(v) => setDiscussionForm({ ...discussionForm, host: v })} options={avTeam.map((l) => ({ value: l.name, label: l.name }))} />
          <Input label="Meeting URL" value={discussionForm.meetingUrl} onChange={(v) => setDiscussionForm({ ...discussionForm, meetingUrl: v })} placeholder="https://zoom.us/j/..." />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAddDiscussion(false)} disabled={loading}>{t.cancel}</Button>
            <Button variant="primary" onClick={handleAddDiscussion} disabled={!discussionForm.title || !discussionForm.date || loading}>{loading ? "Saving..." : t.save}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEditDiscussion} onClose={() => { setShowEditDiscussion(false); setSelDiscussion(null); }} title="Edit Discussion" size="lg" closeOnBackdrop={false}>
        <div className="space-y-4">
          <Input label="Title" value={discussionForm.title} onChange={(v) => setDiscussionForm({ ...discussionForm, title: v })} required />
          <TextArea label="Description" value={discussionForm.description} onChange={(v) => setDiscussionForm({ ...discussionForm, description: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={discussionForm.date} onChange={(v) => setDiscussionForm({ ...discussionForm, date: v })} required />
            <Input label="End Date (optional)" type="date" value={discussionForm.endDate} onChange={(v) => setDiscussionForm({ ...discussionForm, endDate: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Time (US Eastern)" type="time" value={discussionForm.time} onChange={(v) => { const jstTime = convertESTtoJST(v); setDiscussionForm({ ...discussionForm, time: v, timeJST: jstTime }); }} required />
            <Input label="Time (Japan JST)" type="time" value={discussionForm.timeJST} onChange={(v) => { const estTime = convertJSTtoEST(v); setDiscussionForm({ ...discussionForm, timeJST: v, time: estTime }); }} />
          </div>
          <Input label="Topic" value={discussionForm.topic} onChange={(v) => setDiscussionForm({ ...discussionForm, topic: v })} />
          <Select label="Host" value={discussionForm.host} onChange={(v) => setDiscussionForm({ ...discussionForm, host: v })} options={avTeam.map((l) => ({ value: l.name, label: l.name }))} />
          <Input label="Meeting URL" value={discussionForm.meetingUrl} onChange={(v) => setDiscussionForm({ ...discussionForm, meetingUrl: v })} placeholder="https://zoom.us/j/..." />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEditDiscussion(false); setSelDiscussion(null); }} disabled={loading}>{t.cancel}</Button>
            <Button variant="primary" onClick={handleEditDiscussion} disabled={!discussionForm.title || !discussionForm.date || loading}>{loading ? "Saving..." : t.save}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showAddDinner} onClose={() => setShowAddDinner(false)} title={t.addEvent} size="lg" closeOnBackdrop={false}>
        <div className="space-y-4">
          <Input label={t.title} value={dinnerForm.title} onChange={(v) => setDinnerForm({ ...dinnerForm, title: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={dinnerForm.date} onChange={(v) => setDinnerForm({ ...dinnerForm, date: v })} required />
            <Input label="End Date (optional)" type="date" value={dinnerForm.endDate} onChange={(v) => setDinnerForm({ ...dinnerForm, endDate: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Time (US Eastern)" type="time" value={dinnerForm.time} onChange={(v) => { const jstTime = convertESTtoJST(v); setDinnerForm({ ...dinnerForm, time: v, timeJST: jstTime }); }} required />
            <Input label="Time (Japan JST)" type="time" value={dinnerForm.timeJST} onChange={(v) => { const estTime = convertJSTtoEST(v); setDinnerForm({ ...dinnerForm, timeJST: v, time: estTime }); }} />
          </div>
          <Input label={t.venue} value={dinnerForm.venue} onChange={(v) => setDinnerForm({ ...dinnerForm, venue: v })} required />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAddDinner(false)} disabled={loading}>{t.cancel}</Button>
            <Button variant="primary" onClick={handleAddDinner} disabled={!dinnerForm.title || !dinnerForm.date || !dinnerForm.venue || loading}>{loading ? "Saving..." : t.save}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEditDinner} onClose={() => { setShowEditDinner(false); setSelDinner(null); }} title="Edit Event" size="lg" closeOnBackdrop={false}>
        <div className="space-y-4">
          <Input label={t.title} value={dinnerForm.title} onChange={(v) => setDinnerForm({ ...dinnerForm, title: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={dinnerForm.date} onChange={(v) => setDinnerForm({ ...dinnerForm, date: v })} required />
            <Input label="End Date (optional)" type="date" value={dinnerForm.endDate} onChange={(v) => setDinnerForm({ ...dinnerForm, endDate: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Time (US Eastern)" type="time" value={dinnerForm.time} onChange={(v) => { const jstTime = convertESTtoJST(v); setDinnerForm({ ...dinnerForm, time: v, timeJST: jstTime }); }} required />
            <Input label="Time (Japan JST)" type="time" value={dinnerForm.timeJST} onChange={(v) => { const estTime = convertJSTtoEST(v); setDinnerForm({ ...dinnerForm, timeJST: v, time: estTime }); }} />
          </div>
          <Input label={t.venue} value={dinnerForm.venue} onChange={(v) => setDinnerForm({ ...dinnerForm, venue: v })} required />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEditDinner(false); setSelDinner(null); }} disabled={loading}>{t.cancel}</Button>
            <Button variant="primary" onClick={handleEditDinner} disabled={!dinnerForm.title || !dinnerForm.date || !dinnerForm.venue || loading}>{loading ? "Saving..." : t.save}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal isOpen={showDelDiscussion} onClose={() => { setShowDelDiscussion(false); setSelDiscussion(null); }} onConfirm={handleDelDiscussion} title={t.delete} message={`${t.confirmDelete} ${selDiscussion?.title}?`} confirmText={loading ? "Deleting..." : t.delete} disabled={loading} />
      <ConfirmModal isOpen={showDelDinner} onClose={() => { setShowDelDinner(false); setSelDinner(null); }} onConfirm={handleDelDinner} title={t.delete} message={`${t.confirmDelete} ${selDinner?.title}?`} confirmText={loading ? "Deleting..." : t.delete} disabled={loading} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <EmailPreviewModal
        notification={pendingEmail}
        onClose={() => setPendingEmail(null)}
        onSent={() => setToast({ message: "Email notification sent", type: "success" })}
        onError={(error) => setToast({ message: `Email error: ${error.message}`, type: "error" })}
      />
    </div>
  );
};

export default AdminEvents;
