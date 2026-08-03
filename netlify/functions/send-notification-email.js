import { createClient } from "@supabase/supabase-js";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const getBearerToken = (headers = {}) => {
  const auth = headers.authorization || headers.Authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
};

const getTypeLabel = (type) => {
  const labels = {
    announcement: "New Announcement",
    deal: "New Deal",
    event: "New Event",
    document: "New Document",
  };
  return labels[type] || "Kizuna Update";
};

const getSubject = (type, title) => `${getTypeLabel(type)}: ${title}`;
const DEFAULT_CC_EMAIL = "cate.woolsey@av.vc";

const buildHtml = ({ type, title, summary, actionUrl }) => {
  const label = getTypeLabel(type);
  const safeTitle = escapeHtml(title);
  const safeSummary = escapeHtml(summary || "").replace(/\n/g, "<br />");
  const safeUrl = escapeHtml(actionUrl);

  return `
    <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <div style="padding:22px 24px;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(label)}</div>
            <h1 style="font-size:22px;line-height:1.3;margin:8px 0 0;color:#111827;">${safeTitle}</h1>
          </div>
          <div style="padding:22px 24px;">
            ${safeSummary ? `<p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 22px;">${safeSummary}</p>` : ""}
            <a href="${safeUrl}" style="display:inline-block;background:#16396b;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:700;">Open Kizuna Portal</a>
          </div>
        </div>
      </div>
    </div>
  `;
};

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Method Not Allowed" });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const fromName = process.env.SENDGRID_FROM_NAME || "Kizuna Club";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: "Missing Supabase server environment variables" });
    }

    if (!sendgridApiKey || !fromEmail) {
      return jsonResponse(200, { skipped: true, reason: "SendGrid is not configured" });
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (_) {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    const { type, title, summary, subject: subjectOverride, actionUrl } = payload;
    if (!type || !title) {
      return jsonResponse(400, { error: "Missing type or title" });
    }

    const token = getBearerToken(event.headers);
    if (!token) {
      return jsonResponse(401, { error: "Missing auth token" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse(401, { error: "Invalid auth token" });
    }

    const userId = authData.user.id;
    const [memberAdmin, leaderAdmin] = await Promise.all([
      supabase.from("members").select("id").eq("auth_user_id", userId).eq("is_board", true).maybeSingle(),
      supabase.from("leadership").select("id").eq("auth_user_id", userId).maybeSingle(),
    ]);

    if (!memberAdmin.data && !leaderAdmin.data) {
      return jsonResponse(403, { error: "Only admins can send notifications" });
    }

    const membersRes = await supabase.from("members").select("email").not("email", "is", null);

    if (membersRes.error) return jsonResponse(500, { error: membersRes.error.message });

    const recipients = Array.from(
      new Set(
        (membersRes.data || [])
          .map((row) => row.email?.trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const bccRecipients = recipients.includes(DEFAULT_CC_EMAIL)
      ? []
      : [{ email: DEFAULT_CC_EMAIL }];

    if (recipients.length === 0) {
      return jsonResponse(200, { skipped: true, reason: "No recipients" });
    }

    const subject = subjectOverride || getSubject(type, title);
    const emailPayload = {
      personalizations: recipients.map((email) => ({
        to: [{ email }],
        ...(bccRecipients.length > 0 ? { bcc: bccRecipients } : {}),
        subject,
      })),
      from: { email: fromEmail, name: fromName },
      content: [
        {
          type: "text/html",
          value: buildHtml({ type, title, summary, actionUrl }),
        },
      ],
    };

    const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      return jsonResponse(sendgridResponse.status, { error: errorText || "SendGrid send failed" });
    }

    return jsonResponse(200, { success: true, recipients: recipients.length });
  } catch (error) {
    console.error("Unhandled email notification error:", error);
    return jsonResponse(500, { error: error?.message || "Email notification failed" });
  }
};
