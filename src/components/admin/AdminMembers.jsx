import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { colors } from "../../constants/theme";
import { Card, Button, Input, TextArea, Modal, ConfirmModal, Toast } from "../../components/ui";
import { formatDate } from "../../utils/date";
import { genId } from "../../utils/random";
import { Search, Mail, Edit, Trash2, UserPlus, Save, Send, Key, UserCheck, Eye, EyeOff, ArrowLeftRight } from "lucide-react";

// Helper function to get initials from name
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const AdminMembers = ({ t, data, setData, addLog }) => {
  const [tab, setTab] = useState("av"); // 'av' for Alumni Ventures, 'members' for Club Members
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);

  // Member form
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    company: "",
    geography: "",
    interests: ""
  });
  // Leadership form (with additional fields)
  const [leaderForm, setLeaderForm] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
    linkedin: "",
    bio: "",
    company: "",
    location: "",
    notableInvestments: ""
  });

  // Filter out board members from club members
  const clubMembers = data.members.filter((m) => !m.is_board);

  const tabs = [
    { id: "av", label: "Club Leaders", count: data.leadership?.length || 0 },
    { id: "members", label: t.clubMembersList, count: clubMembers.length },
  ];

  const filteredMembers = clubMembers.filter(
    (m) =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.company?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredLeaders = (data.leadership || []).filter(
    (l) =>
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.title?.toLowerCase().includes(search.toLowerCase())
  );

  const resetMemberForm = () =>
    setMemberForm({
      name: "",
      email: "",
      company: "",
      geography: "",
      interests: ""
    });
  const resetLeaderForm = () =>
    setLeaderForm({
      name: "",
      title: "",
      email: "",
      phone: "",
      linkedin: "",
      bio: "",
      company: "",
      location: "",
      notableInvestments: ""
    });

  const getMatchingRecruits = (member, recruits) => {
    if (!member) return [];
    const email = member.email?.trim().toLowerCase();
    const name = member.name?.trim();
    const company = member.company?.trim();
    return (recruits || []).filter((r) => {
      const emailMatch = email && r.email?.trim().toLowerCase() === email;
      const nameMatch = name && r.name?.trim() === name;
      const companyMatch = company ? r.company?.trim() === company : true;
      return emailMatch || (nameMatch && companyMatch);
    });
  };

  const ensureAcceptedRecruitForMember = async (member) => {
    if (!member?.name) return;
    const email = member.email?.trim().toLowerCase();
    const name = member.name?.trim();
    const company = member.company?.trim();

    const localMatch = (data.recruits || []).find((r) => {
      const emailMatch = email && r.email?.trim().toLowerCase() === email;
      const nameMatch = name && r.name?.trim() === name;
      const companyMatch = company ? r.company?.trim() === company : true;
      return emailMatch || (nameMatch && companyMatch);
    });
    if (localMatch) return;

    try {
      if (email) {
        const { data: existingByEmail, error: existingEmailError } = await supabase
          .from('recruits')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        if (existingEmailError && existingEmailError.code !== 'PGRST116') throw existingEmailError;
        if (existingByEmail) {
          setData((p) => ({
            ...p,
            recruits: (p.recruits || []).some((r) => r.id === existingByEmail.id)
              ? p.recruits
              : [...(p.recruits || []), existingByEmail],
          }));
          return;
        }
      }

      let query = supabase.from('recruits').select('*').eq('name', name);
      if (company) query = query.eq('company', company);
      const { data: existingByName, error: existingNameError } = await query.maybeSingle();
      if (existingNameError && existingNameError.code !== 'PGRST116') throw existingNameError;
      if (existingByName) {
        setData((p) => ({
          ...p,
          recruits: (p.recruits || []).some((r) => r.id === existingByName.id)
            ? p.recruits
            : [...(p.recruits || []), existingByName],
        }));
        return;
      }

      const newRecruit = {
        name: member.name,
        email: member.email,
        phone: member.phone,
        company: member.company,
        location: member.location || member.geography,
        linkedin: member.linkedin,
        stage: "accepted"
      };

      const { data: insertedRecruit, error: recruitError } = await supabase
        .from('recruits')
        .insert(newRecruit)
        .select()
        .single();
      if (recruitError) throw recruitError;

      setData((p) => ({
        ...p,
        recruits: [...(p.recruits || []), insertedRecruit],
      }));
    } catch (err) {
      console.error('Error creating accepted recruit for member:', err);
    }
  };

  const moveRecruitToHasAccount = async (person) => {
    if (!person) return;
    const email = person.email?.trim();
    const name = person.name?.trim();
    const company = person.company?.trim();
    const emailLower = email?.toLowerCase();
    const nameLower = name?.toLowerCase();
    const companyLower = company?.toLowerCase();

    const applyLocalUpdate = () => {
      setData((p) => ({
        ...p,
        recruits: (p.recruits || []).map((r) => {
          const emailMatch = emailLower && r.email?.trim().toLowerCase() === emailLower;
          const nameMatch = nameLower && r.name?.trim().toLowerCase() === nameLower;
          const companyMatch = companyLower ? r.company?.trim().toLowerCase() === companyLower : true;
          return emailMatch || (nameMatch && companyMatch) ? { ...r, stage: "uploaded" } : r;
        })
      }));
    };

    try {
      if (email) {
        const { data: updatedByEmail, error: emailError } = await supabase
          .from("recruits")
          .update({ stage: "uploaded" })
          .ilike("email", email)
          .select("id");
        if (emailError) throw emailError;
        if (updatedByEmail && updatedByEmail.length > 0) {
          applyLocalUpdate();
          return;
        }
      }

      if (name) {
        let query = supabase.from("recruits").update({ stage: "uploaded" }).ilike("name", name);
        if (company) query = query.ilike("company", company);
        const { data: updatedByName, error: nameError } = await query.select("id");
        if (nameError) throw nameError;
        if (updatedByName && updatedByName.length > 0) {
          applyLocalUpdate();
        }
      }
    } catch (err) {
      console.error("Error updating recruit stage to Has Account:", err);
    }
  };

  // NEW: Create auth account for member OR leader
  const handleCreateAuthAccount = async (person, isLeader = false) => {
    if (person.auth_user_id) {
      setToast({ message: 'This person already has an auth account!', type: "error" });
      return;
    }
    
    // Generate temporary password
    const tempPassword = `welcome${Math.floor(100 + Math.random() * 900)}`;
    
    if (!window.confirm(`Create account for ${person.name}?\n\nTemp Password: ${tempPassword}\n\nThey will be required to change this on first login.`)) {
      return;
    }
    
    try {
      const response = await fetch('/.netlify/functions/create-auth-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: person.email,
          password: tempPassword,
          memberId: person.id,
          isLeader: isLeader  // Pass whether this is a leader
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create account');
      }
      
      const result = await response.json();
      console.log('Created auth user:', result);
      
      // Update local state to show auth_user_id
      if (isLeader) {
        setData((p) => ({
          ...p,
          leadership: p.leadership.map((l) =>
            l.id === person.id
              ? { ...l, auth_user_id: result.userId, must_change_password: true }
              : l
          )
        }));
      } else {
        setData((p) => ({
          ...p,
          members: p.members.map((m) =>
            m.id === person.id
              ? { ...m, auth_user_id: result.userId, must_change_password: true }
              : m
          )
        }));
        await moveRecruitToHasAccount(person);
      }
      
      // Show success with credentials
      alert(`✅ Account created successfully!\n\nEmail: ${person.email}\nTemp Password: ${tempPassword}\n\n⚠️ Save these credentials to send to ${person.name}.\n\nThey MUST change their password on first login.`);
      
      addLog("authAccountCreated", `Created auth account for: ${person.name}`);
      setToast({ message: `Account created for ${person.name}`, type: "success" });
      
    } catch (error) {
      console.error('Error creating auth account:', error);
      setToast({ message: '❌ Error creating account: ' + error.message, type: "error" });
    }
  };

  // NEW: Reset password for member OR leader
  const handleResetPassword = async (person, isLeader = false) => {
    if (!person.auth_user_id) {
      setToast({ message: 'This person does not have an auth account yet.', type: "error" });
      return;
    }

    const randomPassword = `welcome${Math.floor(100 + Math.random() * 900)}`;
    const promptInput = window.prompt(
      `Reset password for ${person.name}.\n\nEnter a custom password, or leave blank to use a random one.\n(Must be at least 6 characters.)`,
      ''
    );
    if (promptInput === null) return; // cancelled
    const typed = promptInput.trim();
    if (typed && typed.length < 6) {
      setToast({ message: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    const newTempPassword = typed || randomPassword;

    if (!window.confirm(`Reset password for ${person.name}?\n\nNew Password: ${newTempPassword}\n\nThey will be required to change this on first login.`)) {
      return;
    }

    try {
      const response = await fetch('/.netlify/functions/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: person.auth_user_id,
          new_password: newTempPassword,
          isLeader: isLeader
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }
      
      // Update local state
      if (isLeader) {
        setData((p) => ({
          ...p,
          leadership: p.leadership.map((l) =>
            l.id === person.id
              ? { ...l, must_change_password: true }
              : l
          )
        }));
      } else {
        setData((p) => ({
          ...p,
          members: p.members.map((m) =>
            m.id === person.id
              ? { ...m, must_change_password: true }
              : m
          )
        }));
        await moveRecruitToHasAccount(person);
      }
      
      alert(`✅ Password reset!\n\nEmail: ${person.email}\nNew Password: ${newTempPassword}\n\n⚠️ Send these credentials to ${person.name}.`);
      
      addLog("passwordReset", `Reset password for: ${person.name}`);
      setToast({ message: `Password reset for ${person.name}`, type: "success" });
      
    } catch (error) {
      console.error('Error resetting password:', error);
      setToast({ message: '❌ Error: ' + error.message, type: "error" });
    }
  };

  // Member CRUD
  const handleAddMember = async () => {
    if (!memberForm.name || !memberForm.email || !memberForm.company) return;
    try {
      const newM = {
        name: memberForm.name,
        email: memberForm.email,
        company: memberForm.company,
        location: memberForm.geography || "Tokyo",
        interests: memberForm.interests ? memberForm.interests.split(",").map((i) => i.trim()) : []
      };
      const { data: inserted, error } = await supabase.from('members').insert(newM).select().single();
      if (error) throw error;
      setData((p) => ({ ...p, members: [...p.members, { ...inserted, geography: inserted.location }] }));
      await ensureAcceptedRecruitForMember(inserted);
      addLog("memberAdded", `Added member: ${memberForm.name}`);
      setShowAdd(false);
      resetMemberForm();
      setToast({ message: t.savedSuccessfully, type: "success" });
    } catch (err) {
      console.error('Error:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const handleEditMember = async () => {
    if (!memberForm.name || !memberForm.email || !memberForm.company) return;
    try {
      const recruitsToSync = getMatchingRecruits(sel, data.recruits);
      const updates = {
        name: memberForm.name,
        email: memberForm.email,
        company: memberForm.company,
        location: memberForm.geography,
        interests: memberForm.interests ? memberForm.interests.split(",").map((i) => i.trim()) : []
      };
      const { error } = await supabase.from('members').update(updates).eq('id', sel.id);
      if (error) throw error;

      if (recruitsToSync.length > 0) {
        const recruitUpdates = {
          name: memberForm.name,
          email: memberForm.email,
          company: memberForm.company,
          location: memberForm.geography
        };
        await supabase
          .from('recruits')
          .update(recruitUpdates)
          .in('id', recruitsToSync.map((r) => r.id));
      }
      
      // Update local data array with properly mapped fields
      setData((p) => ({ 
        ...p, 
        members: p.members.map((m) => 
          m.id === sel.id 
            ? { 
                ...m, 
                name: memberForm.name,
                nameEn: memberForm.name,
                email: memberForm.email,
                company: memberForm.company,
                location: memberForm.geography,
                geography: memberForm.geography,
                interests: memberForm.interests ? memberForm.interests.split(",").map((i) => i.trim()) : []
              } 
            : m
        ) 
        ,
        recruits: (p.recruits || []).map((r) => {
          const isMatch = recruitsToSync.some((match) => match.id === r.id);
          return isMatch
            ? {
                ...r,
                name: memberForm.name,
                email: memberForm.email,
                company: memberForm.company,
                location: memberForm.geography
              }
            : r;
        })
      }));
      
      addLog("memberEdited", `Edited member: ${memberForm.name}`);
      setShowEdit(false);
      setSel(null);
      resetMemberForm();
      setToast({ message: t.savedSuccessfully, type: "success" });
    } catch (err) {
      console.error('Error:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const handleDelMember = async () => {
    const matchingRecruits = getMatchingRecruits(sel, data.recruits)
      .filter((r) => ["accepted", "uploaded", "invested"].includes(r.stage));

    // Delete auth user first if they have one
    if (sel.auth_user_id) {
      try {
        const response = await fetch('/.netlify/functions/delete-auth-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth_user_id: sel.auth_user_id })
        });
        if (!response.ok) {
          console.error('Failed to delete auth user');
        }
      } catch (err) {
        console.error('Error deleting auth user:', err);
      }
    }
    
    // Delete from Supabase members table
    if (
      supabase &&
      sel.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sel.id)
    ) {
      try {
        await supabase.from("members").delete().eq("id", sel.id);
      } catch (err) {
        console.error("Error deleting member:", err);
      }
    }

    if (matchingRecruits.length > 0) {
      try {
        await supabase
          .from("recruits")
          .delete()
          .in("id", matchingRecruits.map((r) => r.id));
      } catch (err) {
        console.error("Error deleting matching recruit:", err);
      }
    }

    setData((p) => ({
      ...p,
      members: p.members.filter((m) => m.id !== sel.id),
      recruits: matchingRecruits.length > 0
        ? (p.recruits || []).filter((r) => !matchingRecruits.some((m) => m.id === r.id))
        : p.recruits
    }));
    addLog("memberDeleted", `Deleted member: ${sel.name}`, `Member deleted: ${sel.name}`);
    setSel(null);
    setShowDel(false);
    setToast({ message: t.deletedSuccessfully, type: "success" });
  };

  const handleToggleLeaderShowAsMember = async (leader) => {
    const next = leader.show_as_member === true ? false : true;
    try {
      const { error } = await supabase
        .from('leadership')
        .update({ show_as_member: next })
        .eq('id', leader.id);
      if (error) throw error;
      setData((p) => ({
        ...p,
        leadership: (p.leadership || []).map((l) =>
          l.id === leader.id ? { ...l, show_as_member: next } : l
        ),
      }));
      addLog(
        next ? "leaderShownInMembersRow" : "leaderShownInLeadershipRow",
        `${leader.name} now displayed in ${next ? "Members" : "Leadership"} row`
      );
      setToast({
        message: next
          ? `${leader.name} will display in the Members row`
          : `${leader.name} will display in the Leadership row`,
        type: "success",
      });
    } catch (err) {
      console.error('Error toggling leader display row:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const handleToggleLeaderVisibility = async (leader) => {
    const nextVisible = leader.profile_visible === false ? true : false;
    try {
      const { error } = await supabase
        .from('leadership')
        .update({ profile_visible: nextVisible })
        .eq('id', leader.id);
      if (error) throw error;
      setData((p) => ({
        ...p,
        leadership: (p.leadership || []).map((l) =>
          l.id === leader.id ? { ...l, profile_visible: nextVisible } : l
        ),
      }));
      addLog(
        nextVisible ? "leaderProfileShown" : "leaderProfileHidden",
        `${nextVisible ? "Showed" : "Hid"} leader profile: ${leader.name}`
      );
      setToast({
        message: nextVisible
          ? `${leader.name}'s profile is now visible to members`
          : `${leader.name}'s profile is now hidden from members`,
        type: "success",
      });
    } catch (err) {
      console.error('Error toggling leader visibility:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  // Leadership CRUD
  const handleAddLeader = async () => {
    if (!leaderForm.name || !leaderForm.email || !leaderForm.title) return;
    try {
      const newL = {
        name: leaderForm.name,
        title: leaderForm.title,
        email: leaderForm.email,
        phone: leaderForm.phone,
        linkedin: leaderForm.linkedin,
        bio: leaderForm.bio,
        company: leaderForm.company,
        location: leaderForm.location,
        notable_investments: leaderForm.notableInvestments
      };
      const { data: inserted, error } = await supabase.from('leadership').insert(newL).select().single();
      if (error) throw error;
      setData((p) => ({ ...p, leadership: [...(p.leadership || []), inserted] }));
      addLog("leaderAdded", `Added leader: ${leaderForm.name}`);
      setShowAdd(false);
      resetLeaderForm();
      setToast({ message: t.savedSuccessfully, type: "success" });
    } catch (err) {
      console.error('Error:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const handleEditLeader = async () => {
    if (!leaderForm.name || !leaderForm.email || !leaderForm.title) return;
    try {
      const updates = {
        name: leaderForm.name,
        title: leaderForm.title,
        email: leaderForm.email,
        phone: leaderForm.phone,
        linkedin: leaderForm.linkedin,
        bio: leaderForm.bio,
        company: leaderForm.company,
        location: leaderForm.location,
        notable_investments: leaderForm.notableInvestments
      };
      const { error } = await supabase.from('leadership').update(updates).eq('id', sel.id);
      if (error) throw error;
      
      // Update local data array with properly mapped fields
      setData((p) => ({ 
        ...p, 
        leadership: (p.leadership || []).map((l) => 
          l.id === sel.id 
            ? { 
                ...l, 
                name: leaderForm.name,
                nameEn: leaderForm.name,
                title: leaderForm.title,
                email: leaderForm.email,
                phone: leaderForm.phone,
                linkedin: leaderForm.linkedin,
                bio: leaderForm.bio,
                company: leaderForm.company,
                location: leaderForm.location,
                notable_investments: leaderForm.notableInvestments,
                notableInvestments: leaderForm.notableInvestments
              }
            : l
        )
      }));
      
      addLog("leaderEdited", `Edited leader: ${leaderForm.name}`);
      setShowEdit(false);
      setSel(null);
      resetLeaderForm();
      setToast({ message: t.savedSuccessfully, type: "success" });
    } catch (err) {
      console.error('Error:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const handleDelLeader = async () => {
    // Delete auth user first if they have one
    if (sel.auth_user_id) {
      try {
        const response = await fetch('/.netlify/functions/delete-auth-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth_user_id: sel.auth_user_id })
        });
        if (!response.ok) {
          console.error('Failed to delete auth user');
        }
      } catch (err) {
        console.error('Error deleting auth user:', err);
      }
    }
    
    // Delete from Supabase leadership table
    if (
      supabase &&
      sel.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sel.id)
    ) {
      try {
        await supabase.from("leadership").delete().eq("id", sel.id);
      } catch (err) {
        console.error("Error deleting leader:", err);
      }
    }
    setData((p) => ({ ...p, leadership: (p.leadership || []).filter((l) => l.id !== sel.id) }));
    addLog("teamMemberDeleted", `Deleted team member: ${sel.name}`, `Team member deleted: ${sel.name}`);
    setSel(null);
    setShowDel(false);
    setToast({ message: t.deletedSuccessfully, type: "success" });
  };

  const openEditMember = (m) => {
    setSel(m);
    setMemberForm({
      name: m.name,
      email: m.email,
      company: m.company,
      geography: m.geography || m.location || "",
      interests: (m.interests || []).join(", ")
    });
    setShowEdit(true);
  };
  const openEditLeader = (l) => {
    setSel(l);
    setLeaderForm({
      name: l.name,
      title: l.title || "",
      email: l.email,
      phone: l.phone || "",
      linkedin: l.linkedin || "",
      bio: l.bio || "",
      company: l.company || "",
      location: l.location || "",
      notableInvestments: l.notable_investments || l.notableInvestments || ""
    });
    setShowEdit(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t.members}</h2>
          <p className="text-gray-500 text-sm">{t.manageCommunity}</p>
        </div>
        <Button variant="primary" icon={UserPlus} onClick={() => { setShowAdd(true); resetMemberForm(); resetLeaderForm(); }}>
          {tab === "av" ? t.addTeamMember : t.addMember}
        </Button>
      </div>

      <Card>
        <div className="border-b border-gray-200">
          <div className="flex space-x-8">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors relative ${
                  tab === tb.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tb.label}
                <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100 text-gray-600">{tb.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder={t.searchMembers}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Leadership Table */}
          {tab === "av" && filteredLeaders.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t.name}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t.title}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden lg:table-cell">{t.email}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden md:table-cell">Account</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaders.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                          style={{ backgroundColor: colors.primary }}
                        >
                          {getInitials(l.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{l.name}</p>
                          <p className="text-xs text-gray-500 lg:hidden">{l.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{l.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{l.email}</td>
                    <td className="px-4 py-3 text-sm hidden md:table-cell">
                      {l.auth_user_id ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            <UserCheck size={12} />
                            Has Account
                          </span>
                          <button
                            onClick={() => handleResetPassword(l, true)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded"
                            title="Reset Password"
                          >
                            <Key size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCreateAuthAccount(l, true)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Create Account
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {l.profile_visible === false ? (
                          <button
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            onClick={() => handleToggleLeaderVisibility(l)}
                            title="Profile hidden — click to show on dashboard & members page"
                          >
                            <EyeOff size={16} />
                          </button>
                        ) : (
                          <button
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            onClick={() => handleToggleLeaderVisibility(l)}
                            title="Profile visible — click to hide from dashboard & members page"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          className={`p-1.5 rounded ${l.show_as_member ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
                          onClick={() => handleToggleLeaderShowAsMember(l)}
                          title={l.show_as_member ? 'Currently shown in Members row — click to move back to Leadership' : 'Click to show in Members row instead of Leadership'}
                        >
                          <ArrowLeftRight size={16} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" onClick={() => openEditLeader(l)}>
                          <Edit size={16} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => { setSel(l); setShowDel(true); }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Members Table */}
          {tab === "members" && filteredMembers.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t.name}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">{t.company}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden md:table-cell">{t.lastLogin}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 hidden md:table-cell">Account</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                          style={{ backgroundColor: colors.accent }}
                        >
                          {getInitials(m.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.company}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{formatDate(m.lastLogin)}</td>
                    <td className="px-4 py-3 text-sm hidden md:table-cell">
                      {m.auth_user_id ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            <UserCheck size={12} />
                            Has Account
                          </span>
                          <button
                            onClick={() => handleResetPassword(m, false)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded"
                            title="Reset Password"
                          >
                            <Key size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCreateAuthAccount(m, false)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Create Account
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" onClick={() => { setSel(m); setShowEmail(true); }}>
                          <Mail size={16} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" onClick={() => openEditMember(m)}>
                          <Edit size={16} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => { setSel(m); setShowDel(true); }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(tab === "av" ? filteredLeaders : filteredMembers).length === 0 && (
            <p className="text-center text-gray-500 py-8">{t.noResults}</p>
          )}
        </div>
      </Card>

      {/* Add Modal - Members */}
      <Modal isOpen={showAdd && tab === "members"} onClose={() => setShowAdd(false)} title={t.addMember}>
        <div className="space-y-4">
          <Input label={t.name} value={memberForm.name} onChange={(v) => setMemberForm({ ...memberForm, name: v })} required placeholder="John Smith" />
          <Input label={t.email} type="email" value={memberForm.email} onChange={(v) => setMemberForm({ ...memberForm, email: v })} required placeholder="john@company.com" />
          <Input label={t.company} value={memberForm.company} onChange={(v) => setMemberForm({ ...memberForm, company: v })} required placeholder="Company Inc." />
          <Input label={t.location} value={memberForm.geography} onChange={(v) => setMemberForm({ ...memberForm, geography: v })} placeholder="Tokyo" />
          <Input label={t.interests + " (comma separated)"} value={memberForm.interests} onChange={(v) => setMemberForm({ ...memberForm, interests: v })} placeholder="AI, FinTech" />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t.cancel}</Button>
            <Button variant="primary" icon={Save} onClick={handleAddMember} disabled={!memberForm.name || !memberForm.email || !memberForm.company}>{t.save}</Button>
          </div>
        </div>
      </Modal>

      {/* Add Modal - Leadership */}
      <Modal isOpen={showAdd && tab === "av"} onClose={() => setShowAdd(false)} title={t.addTeamMember} size="lg">
        <div className="space-y-4">
          <Input label={t.name} value={leaderForm.name} onChange={(v) => setLeaderForm({ ...leaderForm, name: v })} required placeholder="John Smith" />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.title} value={leaderForm.title} onChange={(v) => setLeaderForm({ ...leaderForm, title: v })} required placeholder="Managing Partner" />
            <Input label={t.email} type="email" value={leaderForm.email} onChange={(v) => setLeaderForm({ ...leaderForm, email: v })} required placeholder="john@av.vc" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.company} value={leaderForm.company} onChange={(v) => setLeaderForm({ ...leaderForm, company: v })} placeholder="Alumni Ventures" />
            <Input label={t.location} value={leaderForm.location} onChange={(v) => setLeaderForm({ ...leaderForm, location: v })} placeholder="Boston / Tokyo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.phone} value={leaderForm.phone} onChange={(v) => setLeaderForm({ ...leaderForm, phone: v })} placeholder="+1 555-123-4567" />
            <Input label={t.linkedin} value={leaderForm.linkedin} onChange={(v) => setLeaderForm({ ...leaderForm, linkedin: v })} placeholder="https://linkedin.com/in/..." />
          </div>
          <TextArea label={t.bio} value={leaderForm.bio} onChange={(v) => setLeaderForm({ ...leaderForm, bio: v })} rows={3} placeholder="Brief background and expertise..." />
          <TextArea label="Notable Investments" value={leaderForm.notableInvestments} onChange={(v) => setLeaderForm({ ...leaderForm, notableInvestments: v })} rows={2} placeholder="e.g., Sequoia Capital, SoftBank Vision Fund, Goldman Sachs" />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t.cancel}</Button>
            <Button variant="primary" icon={Save} onClick={handleAddLeader} disabled={!leaderForm.name || !leaderForm.email || !leaderForm.title}>{t.save}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal - Members */}
      <Modal isOpen={showEdit && tab === "members"} onClose={() => { setShowEdit(false); setSel(null); }} title={t.editMember}>
        <div className="space-y-4">
          <Input label={t.name} value={memberForm.name} onChange={(v) => setMemberForm({ ...memberForm, name: v })} required />
          <Input label={t.email} type="email" value={memberForm.email} onChange={(v) => setMemberForm({ ...memberForm, email: v })} required />
          <Input label={t.company} value={memberForm.company} onChange={(v) => setMemberForm({ ...memberForm, company: v })} required />
          <Input label={t.location} value={memberForm.geography} onChange={(v) => setMemberForm({ ...memberForm, geography: v })} />
          <Input label={t.interests + " (comma separated)"} value={memberForm.interests} onChange={(v) => setMemberForm({ ...memberForm, interests: v })} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEdit(false); setSel(null); }}>{t.cancel}</Button>
            <Button variant="primary" icon={Save} onClick={handleEditMember} disabled={!memberForm.name || !memberForm.email || !memberForm.company}>{t.save}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal - Leadership */}
      <Modal isOpen={showEdit && tab === "av"} onClose={() => { setShowEdit(false); setSel(null); }} title={t.editTeamMember} size="lg">
        <div className="space-y-4">
          <Input label={t.name} value={leaderForm.name} onChange={(v) => setLeaderForm({ ...leaderForm, name: v })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.title} value={leaderForm.title} onChange={(v) => setLeaderForm({ ...leaderForm, title: v })} required />
            <Input label={t.email} type="email" value={leaderForm.email} onChange={(v) => setLeaderForm({ ...leaderForm, email: v })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.company} value={leaderForm.company} onChange={(v) => setLeaderForm({ ...leaderForm, company: v })} placeholder="Alumni Ventures" />
            <Input label={t.location} value={leaderForm.location} onChange={(v) => setLeaderForm({ ...leaderForm, location: v })} placeholder="Boston / Tokyo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.phone} value={leaderForm.phone} onChange={(v) => setLeaderForm({ ...leaderForm, phone: v })} />
            <Input label={t.linkedin} value={leaderForm.linkedin} onChange={(v) => setLeaderForm({ ...leaderForm, linkedin: v })} />
          </div>
          <TextArea label={t.bio} value={leaderForm.bio} onChange={(v) => setLeaderForm({ ...leaderForm, bio: v })} rows={3} />
          <TextArea label="Notable Investments" value={leaderForm.notableInvestments} onChange={(v) => setLeaderForm({ ...leaderForm, notableInvestments: v })} rows={2} placeholder="e.g., Sequoia Capital, SoftBank Vision Fund, Goldman Sachs" />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEdit(false); setSel(null); }}>{t.cancel}</Button>
            <Button variant="primary" icon={Save} onClick={handleEditLeader} disabled={!leaderForm.name || !leaderForm.email || !leaderForm.title}>{t.save}</Button>
          </div>
        </div>
      </Modal>

      {/* Email Modal */}
      <Modal isOpen={showEmail} onClose={() => { setShowEmail(false); setSel(null); }} title={t.sendEmail}>
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">{t.to}:</p>
            <p className="font-medium text-gray-900">
              {sel?.name} ({sel?.email})
            </p>
          </div>
          <Input label={t.subject} value="" onChange={() => {}} placeholder="Enter subject..." />
          <TextArea label={t.message} value="" onChange={() => {}} rows={5} placeholder="Enter message..." />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEmail(false); setSel(null); }}>{t.cancel}</Button>
            <Button
              variant="primary"
              icon={Send}
              onClick={() => {
                addLog(
                  "emailSent",
                  `Email sent to: ${sel?.name}`,
                  `Email sent to: ${sel?.name}`
                );
                setShowEmail(false);
                setSel(null);
                setToast({ message: t.emailSentSuccess, type: "success" });
              }}
            >
              {t.send}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDel}
        onClose={() => { setShowDel(false); setSel(null); }}
        onConfirm={tab === "av" ? handleDelLeader : handleDelMember}
        title={t.delete}
        message={`${t.confirmDelete} ${sel?.name}?`}
        confirmText={t.delete}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AdminMembers;
