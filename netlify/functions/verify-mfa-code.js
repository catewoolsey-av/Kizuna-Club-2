import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const MAX_ATTEMPTS = 5;

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

const handle = async (event) => {
  if (event.httpMethod !== "POST") {
    if (event.httpMethod === "OPTIONS") return jsonResponse(200, { ok: true });
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
  const mfaCode = user.app_metadata?.mfa_email_code;
  if (!mfaCode?.code_hash || !mfaCode?.expires_at) {
    return jsonResponse(400, { error: "No active verification code. Request a new code." });
  }

  if (new Date(mfaCode.expires_at).getTime() < Date.now()) {
    return jsonResponse(400, { error: "This code expired. Request a new code." });
  }

  if ((mfaCode.attempts || 0) >= MAX_ATTEMPTS) {
    return jsonResponse(429, { error: "Too many incorrect attempts. Request a new code." });
  }

  const expectedHash = hashCode(code, user.id);
  if (!equalHashes(expectedHash, mfaCode.code_hash)) {
    await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...user.app_metadata,
        mfa_email_code: {
          ...mfaCode,
          attempts: (mfaCode.attempts || 0) + 1,
        },
      },
    });
    return jsonResponse(400, { error: "Invalid verification code." });
  }

  const { mfa_email_code: _usedCode, ...nextAppMetadata } = user.app_metadata || {};
  const update = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: nextAppMetadata,
  });

  if (update.error) return jsonResponse(500, { error: update.error.message });

  return jsonResponse(200, { success: true });
};

export const handler = async (event) => {
  try {
    return await handle(event);
  } catch (error) {
    console.error("Unhandled MFA verify error:", error);
    return jsonResponse(500, { error: error?.message || "MFA verification failed" });
  }
};
