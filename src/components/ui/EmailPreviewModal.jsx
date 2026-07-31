import React, { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { notifyMembers } from "../../utils/notifications";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { TextArea } from "./TextArea";

const getTypeLabel = (type) => {
  const labels = {
    announcement: "New Announcement",
    deal: "New Deal",
    event: "New Event",
    document: "New Document",
  };
  return labels[type] || "Kizuna Update";
};

export const EmailPreviewModal = ({ notification, onClose, onSent, onError }) => {
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!notification) return;
    const label = getTypeLabel(notification.type);
    setSubject(notification.subject || `${label}: ${notification.title || ""}`);
    setHeadline(notification.title || "");
    setMessage(notification.summary || "");
  }, [notification]);

  if (!notification) return null;

  const handleSend = async () => {
    setSending(true);
    try {
      await notifyMembers({
        type: notification.type,
        title: headline,
        summary: message,
        subject,
        actionUrl: notification.actionUrl,
      });
      onSent?.();
      onClose();
    } catch (error) {
      onError?.(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen={!!notification}
      onClose={onClose}
      title="Preview Email Notification"
      size="lg"
      closeOnBackdrop={false}
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Input label="Subject" value={subject} onChange={setSubject} required />
            <Input label="Headline" value={headline} onChange={setHeadline} required />
            <TextArea label="Message" value={message} onChange={setMessage} rows={7} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Mail size={15} />
              Email Preview
            </div>
            <div className="p-4">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                    {getTypeLabel(notification.type)}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1 leading-snug">
                    {headline || "Email headline"}
                  </h3>
                </div>
                <div className="p-4">
                  {message ? (
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{message}</p>
                  ) : (
                    <p className="text-sm text-gray-400">No message text.</p>
                  )}
                  <div className="mt-4">
                    <span className="inline-flex rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white">
                      Open Kizuna Portal
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Skip Email
          </Button>
          <Button
            variant="primary"
            icon={Send}
            onClick={handleSend}
            disabled={!subject.trim() || !headline.trim() || sending}
          >
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
