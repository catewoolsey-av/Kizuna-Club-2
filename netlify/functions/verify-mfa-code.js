const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const MAX_ATTEMPTS = 5;

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

const hashCode = (code, userId) =>
  crypto
    .createHmac("sha256", process.env.MFA_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`${userId}:${code}`)
    .digest("hex");

const equalHashes = (a, b) => {
  const left = Buffer.from(a || "", "hex");
  const right = Buffer.from(b || "", "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase server environment variables" });
  }

  const token = getBearerToken(event.headers);
  if (!token) {
    return jsonResponse(401, { error: "Missing auth token" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (_) {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const code = String(payload.code || "").replace(/\D/g, "");
  if (code.length !== 8) {
    return jsonResponse(400, { error: "Enter the 8-digit verification code." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse(401, { error: "Invalid auth token" });
  }

  const user = authData.user;
  const { data: codeRows, error: codeError } = await supabase
    .from("mfa_email_codes")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("auth_user_id", user.id)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (codeError) return jsonResponse(500, { error: codeError.message });

  const row = codeRows?.[0];
  if (!row) {
    return jsonResponse(400, { error: "No active verification code. Request a new code." });
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return jsonResponse(400, { error: "This code expired. Request a new code." });
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return jsonResponse(429, { error: "Too many incorrect attempts. Request a new code." });
  }

  const expectedHash = hashCode(code, user.id);
  if (!equalHashes(expectedHash, row.code_hash)) {
    await supabase
      .from("mfa_email_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return jsonResponse(400, { error: "Invalid verification code." });
  }

  const update = await supabase
    .from("mfa_email_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  if (update.error) return jsonResponse(500, { error: update.error.message });

  return jsonResponse(200, { success: true });
};
