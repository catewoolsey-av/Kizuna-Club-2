import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { colors } from "../../constants/theme";
import { Card, Badge, Button, Input, TextArea, Modal, ConfirmModal, Toast } from "../../components/ui";
import { formatDate } from "../../utils/date";
import { Mail, Megaphone, Trash2, Pin, Upload, Edit } from "lucide-react";

const AdminAnnouncements = ({ t, data, setData, addLog, userProfile }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    pinned: false,
  });

  const reset = () =>
    setForm({
      title: "",
      content: "",
      pinned: false,
    });

  const handleCreate = async () => {
    if (!form.title) return;
    try {
      const authorName =
        userProfile?.name ||
        userProfile?.nameEn ||
        userProfile?.email ||
        "Admin";

      const newA = {
        title: form.title,
        content: form.content,
        author: authorName,
        status: 'published',
        pinned: false, // Always create unpinned, use pin button to pin later
      };

      const { data: inserted, error } = await supabase.from('announcements').insert(newA).select().single();
      if (error) throw error;

      const mapped = {
        ...inserted,
        scheduledDate: inserted.scheduled_date,
        createdAt: inserted.created_at,
      };

      // Add to local state
      setData((p) => ({
        ...p,
        announcements: [mapped, ...p.announcements]
      }));

      addLog("announcementCreated", `Created announcement: ${form.title}`);
      setShowCreate(false);
      reset();
      setToast({ message: "Announcement created", type: "success" });
    } catch (err) {
      console.error('Error:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const openEdit = (announcement) => {
    setSel(announcement);
    setForm({
      title: announcement.title,
      content: announcement.content,
      pinned: announcement.pinned || false,
    });
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!form.title || !sel) return;
    try {
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sel.id);
      
      // Only update Supabase if this is a valid UUID
      if (isValidUUID) {
        const updates = {
          title: form.title,
          content: form.content,
        };

        const { error } = await supabase
          .from('announcements')
          .update(updates)
          .eq('id', sel.id);

        if (error) throw error;
      }

      // Update local state
      setData((p) => ({
        ...p,
        announcements: p.announcements.map((a) =>
          a.id === sel.id
            ? {
                ...a,
                title: form.title,
                content: form.content,
              }
            : a
        ),
      }));
      
      addLog("announcementUpdated", `Updated announcement: ${form.title}`);
      setShowEdit(false);
      setSel(null);
      reset();
      setToast({ message: "Announcement updated", type: "success" });
    } catch (err) {
      console.error('Error:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const handleDel = async () => {
    try {
      // Check if this is a valid UUID before attempting Supabase deletion
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sel.id);
      
      // Only try to delete from Supabase if it's a valid UUID
      if (isValidUUID) {
        const { error } = await supabase.from('announcements').delete().eq('id', sel.id);
        if (error) throw error;
      }
      
      // Always remove from local state (handles both Supabase records and legacy INITIAL_DATA)
      setData((p) => ({ ...p, announcements: p.announcements.filter((a) => a.id !== sel.id) }));
      addLog("announcementDeleted", `Deleted announcement: ${sel.title}`);
      setShowDel(false);
      setSel(null);
      setToast({ message: "Announcement deleted", type: "success" });
    } catch (err) {
      console.error('Error:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  const handleTogglePin = async (announcement) => {
    try {
      const newPinStatus = !announcement.pinned;
      
      // Check if this is a valid UUID
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(announcement.id);
      
      // Only update Supabase if this is a valid UUID
      if (isValidUUID) {
        // If pinning this announcement, unpin all others first
        if (newPinStatus) {
          const pinnedAnnouncements = data.announcements.filter(a => a.pinned && a.id !== announcement.id);
          for (const a of pinnedAnnouncements) {
            // Only update Supabase records with valid UUIDs
            const isPinnedValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.id);
            if (isPinnedValidUUID) {
              const { error: unpinError } = await supabase
                .from('announcements')
                .update({ pinned: false })
                .eq('id', a.id);
              if (unpinError) throw unpinError;
            }
          }
        }
        
        // Update the selected announcement
        const { error } = await supabase
          .from('announcements')
          .update({ pinned: newPinStatus })
          .eq('id', announcement.id);
        
        if (error) throw error;
      }
      
      // Always update local state (handles both Supabase records and legacy INITIAL_DATA)
      setData((p) => ({
        ...p,
        announcements: p.announcements.map((a) =>
          a.id === announcement.id
            ? { ...a, pinned: newPinStatus }
            : newPinStatus
            ? { ...a, pinned: false }
            : a
        ),
      }));
      
      addLog(
        newPinStatus ? "announcementPinned" : "announcementUnpinned",
        `${newPinStatus ? 'Pinned' : 'Unpinned'} announcement: ${announcement.title}`
      );
      setToast({ 
        message: newPinStatus ? "Announcement pinned" : "Announcement unpinned", 
        type: "success" 
      });
    } catch (err) {
      console.error('Error:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-gray-900">{t.communications}</h2>
        <Button variant="primary" icon={Megaphone} onClick={() => { reset(); setShowCreate(true); }}>{t.createAnnouncement}</Button>
      </div>

      <div className="space-y-4">
        {data.announcements.filter(a => a.status === 'published').length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-8">{t.noResults}</p>
          </Card>
        ) : (
          data.announcements
            .filter(a => a.status === 'published')
            .sort((a, b) => {
              // Pinned announcements come first
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              // Then sort by date (most recent first)
              return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp);
            })
            .map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    {a.pinned && <Badge variant="primary">{t.pinned}</Badge>}
                    <Badge variant={a.status === "published" ? "success" : "warning"}>{a.status === "published" ? t.published : t.scheduled}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{a.content}</p>
                  {a.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {a.attachments.map((att, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                          <Upload size={12} />
                          {att.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    {a.status === "published"
                      ? `${a.author} · ${formatDate(a.timestamp)}`
                      : `${t.scheduledFor}: ${formatDate(a.scheduledDate)}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    icon={Pin} 
                    className={a.pinned ? "text-blue-600" : "text-gray-400"}
                    onClick={() => handleTogglePin(a)} 
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    icon={Edit} 
                    className="text-gray-600"
                    onClick={() => openEdit(a)} 
                  />
                  <Button variant="ghost" size="sm" icon={Trash2} className="text-red-500" onClick={() => { setSel(a); setShowDel(true); }} />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={t.createAnnouncement} size="lg">
        <div className="space-y-4">
          <Input label={t.title} value={form.title} onChange={(v) => setForm({ ...form, title: v })} required placeholder="Important announcement..." />
          <TextArea label={t.message} value={form.content} onChange={(v) => setForm({ ...form, content: v })} rows={4} required placeholder="Your message..." />
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
            <input
              type="text"
              value={userProfile?.name || userProfile?.nameEn || userProfile?.email || "Admin"}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t.cancel}</Button>
            <Button
              variant="primary"
              icon={Megaphone}
              onClick={handleCreate}
              disabled={!form.title || !form.content}
            >
              {t.publish}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setSel(null); reset(); }} title="Edit Announcement" size="lg">
        <div className="space-y-4">
          <Input label={t.title} value={form.title} onChange={(v) => setForm({ ...form, title: v })} required placeholder="Important announcement..." />
          <TextArea label={t.message} value={form.content} onChange={(v) => setForm({ ...form, content: v })} rows={4} required placeholder="Your message..." />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEdit(false); setSel(null); reset(); }}>{t.cancel}</Button>
            <Button
              variant="primary"
              icon={Edit}
              onClick={handleUpdate}
              disabled={!form.title || !form.content}
            >
              Update
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showDel}
        onClose={() => { setShowDel(false); setSel(null); }}
        onConfirm={handleDel}
        title={t.delete}
        message={`${t.confirmDelete} "${sel?.title}"?`}
        confirmText={t.delete}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AdminAnnouncements;
