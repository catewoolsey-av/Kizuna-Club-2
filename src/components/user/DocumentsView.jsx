import React, { useState } from "react";
import { Archive, Download, Edit, FileText, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { Button, Card, ConfirmModal, EmailPreviewModal, Input, Modal, TextArea, Toast } from "../../components/ui";

const emptyForm = { title: "", body: "" };

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const mapUpdate = (row) => ({
  ...row,
  documentUrl: row.document_url,
  documentName: row.document_name,
  postedBy: row.posted_by,
  postedById: row.posted_by_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isArchived: row.is_archived === true,
});

const DocumentsView = ({ data, setData, userProfile, isAdmin, addLog }) => {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [viewUpdate, setViewUpdate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingEmail, setPendingEmail] = useState(null);

  const allUpdates = data.documentUpdates || [];
  const visibleUpdates = allUpdates.filter((update) => !update.isArchived);

  const reset = () => {
    setForm(emptyForm);
    setFile(null);
    setEditingUpdate(null);
  };

  const openNew = () => {
    reset();
    setShowComposer(true);
  };

  const openEdit = (update) => {
    setEditingUpdate(update);
    setForm({ title: update.title || "", body: update.body || "" });
    setFile(null);
    setShowComposer(true);
  };

  const closeComposer = () => {
    setShowComposer(false);
    reset();
  };

  const uploadDocument = async (selectedFile) => {
    if (!selectedFile) return { documentUrl: null, documentName: null };

    const fileExt = selectedFile.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `deal-media/${fileName}`;

    const { error } = await supabase.storage
      .from("deal-documents")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw new Error(error.message || "Document upload failed");

    const { data: urlData } = supabase.storage
      .from("deal-documents")
      .getPublicUrl(filePath);

    return {
      documentUrl: urlData.publicUrl,
      documentName: selectedFile.name,
    };
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      const uploaded = await uploadDocument(file);
      const basePayload = {
        title: form.title.trim(),
        body: form.body.trim() || null,
      };

      if (editingUpdate) {
        const updates = {
          ...basePayload,
          updated_at: new Date().toISOString(),
          ...(uploaded.documentUrl
            ? {
                document_url: uploaded.documentUrl,
                document_name: uploaded.documentName,
              }
            : {}),
        };

        const { data: saved, error } = await supabase
          .from("document_updates")
          .update(updates)
          .eq("id", editingUpdate.id)
          .select()
          .single();

        if (error) throw error;

        const mapped = mapUpdate(saved);
        setData((prev) => ({
          ...prev,
          documentUpdates: (prev.documentUpdates || []).map((item) =>
            item.id === mapped.id ? mapped : item
          ),
        }));
        addLog?.("documentEdited", `Edited document update: ${form.title}`);
        setToast({ message: "Document update saved", type: "success" });
      } else {
        const payload = {
          ...basePayload,
          document_url: uploaded.documentUrl,
          document_name: uploaded.documentName,
          posted_by: userProfile?.name || userProfile?.nameEn || "Admin",
          posted_by_id: userProfile?.id || null,
          is_archived: false,
        };

        const { data: inserted, error } = await supabase
          .from("document_updates")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        const mapped = mapUpdate(inserted);
        setData((prev) => ({
          ...prev,
          documentUpdates: [mapped, ...(prev.documentUpdates || [])],
        }));
        addLog?.("documentPosted", `Posted document update: ${form.title}`);
        setPendingEmail({
          type: "document",
          title: form.title,
          summary: form.body,
          actionUrl: window.location.origin,
        });
        setToast({ message: "Document update posted", type: "success" });
      }

      closeComposer();
    } catch (error) {
      setToast({ message: `Error: ${error.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (update) => {
    try {
      const { data: saved, error } = await supabase
        .from("document_updates")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("id", update.id)
        .select()
        .single();

      if (error) throw error;

      const mapped = mapUpdate(saved);
      setData((prev) => ({
        ...prev,
        documentUpdates: (prev.documentUpdates || []).map((item) =>
          item.id === mapped.id ? mapped : item
        ),
      }));
      addLog?.("documentArchived", `Archived document update: ${update.title}`);
      setToast({ message: "Document update archived", type: "success" });
    } catch (error) {
      setToast({ message: `Error: ${error.message}`, type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const { error } = await supabase
        .from("document_updates")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) throw error;

      setData((prev) => ({
        ...prev,
        documentUpdates: (prev.documentUpdates || []).filter((item) => item.id !== deleteTarget.id),
      }));
      addLog?.("documentDeleted", `Deleted document update: ${deleteTarget.title}`);
      setToast({ message: "Document update deleted", type: "success" });
      setDeleteTarget(null);
    } catch (error) {
      setToast({ message: `Error: ${error.message}`, type: "error" });
    }
  };

  const attachmentInput = (
    <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg px-3 py-3 cursor-pointer hover:bg-gray-50 text-sm text-gray-700">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        {file ? <Paperclip size={16} /> : <Upload size={16} />}
      </div>
      <span className="truncate">
        {file ? file.name : editingUpdate?.documentName ? `Keep ${editingUpdate.documentName}, or choose a replacement` : "Choose a PDF, deck, spreadsheet, or doc"}
      </span>
      <input
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
          <p className="text-sm text-gray-600 mt-1">Team updates, memos, decks, and supporting materials.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{visibleUpdates.length} {visibleUpdates.length === 1 ? "post" : "posts"}</span>
          {isAdmin && (
            <Button variant="primary" icon={Plus} onClick={openNew}>
              New Update
            </Button>
          )}
        </div>
      </div>

      {visibleUpdates.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText size={30} className="mx-auto text-gray-400 mb-3" />
            <p className="font-medium text-gray-900">No documents posted yet</p>
            <p className="text-sm text-gray-500 mt-1">Updates will appear here when the team posts them.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleUpdates.map((update) => (
            <Card key={update.id} className="border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileText size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-medium text-gray-700">{update.postedBy || "Kizuna Team"}</span>
                      <span>•</span>
                      <span>{formatDate(update.createdAt || update.created_at)}</span>
                      {update.updatedAt && <span>Edited</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 leading-snug">{update.title}</h3>
                    {update.body && (
                      <div className="mt-1">
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{update.body}</p>
                        {update.body.length > 180 && (
                          <button
                            type="button"
                            onClick={() => setViewUpdate(update)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-1"
                          >
                            View full update
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {update.documentUrl && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">ATTACHMENT</div>
                      <a
                        href={update.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                        title={update.documentName || "Download document"}
                      >
                        <Download size={12} className="flex-shrink-0" />
                        <span className="truncate max-w-[360px]">{update.documentName || "Download"}</span>
                      </a>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Actions</div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" icon={Edit} onClick={() => openEdit(update)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" icon={Archive} onClick={() => handleArchive(update)}>
                          Archive
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(update)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showComposer}
        onClose={closeComposer}
        title={editingUpdate ? "Edit Document Update" : "New Document Update"}
        size="lg"
        closeOnBackdrop={false}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
            placeholder="Budget forecast update"
            required
          />
          <TextArea
            label="Note"
            value={form.body}
            onChange={(v) => setForm({ ...form, body: v })}
            placeholder="Short context for members"
            rows={5}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attachment</label>
            {attachmentInput}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={closeComposer} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!form.title.trim() || saving}>
              {saving ? "Saving..." : editingUpdate ? "Save Changes" : "Post Update"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!viewUpdate}
        onClose={() => setViewUpdate(null)}
        title={viewUpdate?.title || "Document Update"}
        size="md"
      >
        {viewUpdate && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              {viewUpdate.postedBy || "Kizuna Team"} • {formatDate(viewUpdate.createdAt || viewUpdate.created_at)}
            </div>
            {viewUpdate.body && (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{viewUpdate.body}</p>
            )}
            {viewUpdate.documentUrl && (
              <a
                href={viewUpdate.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:border-gray-300 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <Download size={13} className="text-gray-500" />
                <span className="truncate max-w-[280px]">{viewUpdate.documentName || "Download"}</span>
              </a>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Document Update"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete"
      />

      <EmailPreviewModal
        notification={pendingEmail}
        onClose={() => setPendingEmail(null)}
        onSent={() => setToast({ message: "Email notification sent", type: "success" })}
        onError={(error) => setToast({ message: `Email error: ${error.message}`, type: "error" })}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default DocumentsView;
