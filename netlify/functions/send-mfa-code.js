const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const CODE_TTL_MINUTES = 10;
const RESEND_SECONDS = 90;

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const getBearerToken = (headers = {}) => {
  const auth = headers.authorization || headers.Authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const hashCode = (code, userId) =>
  crypto
    .createHmac("sha256", process.env.MFA_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`${userId}:${code}`)
    .digest("hex");

const buildHtml = ({ code, fromName }) => `
  <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:520px;margin:0 auto;padding:28px 18px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="padding:24px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:12px;font-weight:700;color:#16396b;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(fromName)}</div>
          <h1 style="font-size:22px;line-height:1.3;margin:8px 0 0;color:#111827;">Your Kizuna Club sign-in code</h1>
        </div>
        <div style="padding:24px;">
          <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 18px;">Enter this code in the Kizuna Club sign-in screen.</p>
          <div style="font-size:32px;line-height:1;font-weight:700;letter-spacing:8px;color:#111827;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;text-align:center;">${code}</div>
          <p style="font-size:13px;line-height:1.5;color:#6b7280;margin:18px 0 0;">This code expires in ${CODE_TTL_MINUTES} minutes. If you did not request it, you can ignore this email.</p>
        </div>
      </div>
    </div>
  </div>
`;

exports.handler = async (event) => {
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
    return jsonResponse(500, { error: "SendGrid is not configured" });
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

  const user = authData.user;
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return jsonResponse(400, { error: "User email is missing" });
  }

  const since = new Date(Date.now() - RESEND_SECONDS * 1000).toISOString();
  const recent = await supabase
    .from("mfa_email_codes")
    .select("id")
    .eq("auth_user_id", user.id)
    .gte("created_at", since)
    .limit(1);

  if (recent.error) return jsonResponse(500, { error: recent.error.message });
  if ((recent.data || []).length > 0) {
    return jsonResponse(429, { error: `Please wait ${RESEND_SECONDS} seconds before requesting another code.` });
  }

  const code = String(crypto.randomInt(0, 100000000)).padStart(8, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  const insert = await supabase.from("mfa_email_codes").insert({
    auth_user_id: user.id,
    email,
    code_hash: hashCode(code, user.id),
    expires_at: expiresAt,
  });

  if (insert.error) return jsonResponse(500, { error: insert.error.message });

  const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }], subject: "Your Kizuna Club sign-in code" }],
      from: { email: fromEmail, name: fromName },
      content: [{ type: "text/html", value: buildHtml({ code, fromName }) }],
    }),
  });

  if (!sendgridResponse.ok) {
    const errorText = await sendgridResponse.text();
    return jsonResponse(sendgridResponse.status, { error: errorText || "SendGrid send failed" });
  }

  return jsonResponse(200, { success: true, expiresAt });
};
