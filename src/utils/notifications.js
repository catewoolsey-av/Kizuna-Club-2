import { supabase } from "../lib/supabaseClient";

export const notifyMembers = async ({ type, title, summary, subject, actionUrl }) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again to send this email.");

  const response = await fetch("/.netlify/functions/send-notification-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type,
      title,
      summary,
      subject,
      actionUrl: actionUrl || window.location.origin,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Email notification failed");
  }
};
