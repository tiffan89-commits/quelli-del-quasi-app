import {filterMailRecipients} from './release-env.mjs';
import { recordExternal } from "./platform-admin.mjs";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
export function mailConfig(env = process.env) {
  return {
    ...env,
    APP_BASE_URL: env.APP_BASE_URL || "https://quellidelquasi.com",
    MAIL_FROM: env.MAIL_FROM || "Quelli del Quasi <account@quellidelquasi.com>",
  };
}
export function mailReady(env = process.env) {
  env = mailConfig(env);
  try {
    return !!(
      env.RESEND_API_KEY &&
      env.MAIL_FROM &&
      new URL(env.APP_BASE_URL).protocol === "https:" &&
      !new URL(env.APP_BASE_URL).username &&
      !new URL(env.APP_BASE_URL).password
    );
  } catch {
    return false;
  }
}
function key(env) {
  return createHash("sha256")
    .update(env.MAIL_ENCRYPTION_KEY || env.RESEND_API_KEY || "")
    .digest();
}
export function queueMail(
  s,
  message,
  env = process.env,
  expires = Date.now() + 24 * 3600000,
) {
  env = mailConfig(env);
  if (!mailReady(env))
    throw Object.assign(
      Error("Servizio email temporaneamente non disponibile"),
      { status: 503 },
    );
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(env), iv),
    body = Buffer.concat([
      cipher.update(JSON.stringify(message)),
      cipher.final(),
    ]);
  const id = randomBytes(16).toString("hex");
  s.mailOutbox ??= [];
  s.mailOutbox.push({
    id,
    expires,
    iv: iv.toString("base64"),
    body: body.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    attempts: 0,
    created: Date.now(),
    nextAt: 0,
  });
  return id;
}
export function decodeMail(job, env = process.env) {
  const d = createDecipheriv(
    "aes-256-gcm",
    key(env),
    Buffer.from(job.iv, "base64"),
  );
  d.setAuthTag(Buffer.from(job.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      d.update(Buffer.from(job.body, "base64")),
      d.final(),
    ]).toString(),
  );
}
export function mailError(code, status) {
  return Object.assign(new Error("Invio email non riuscito"), {
    mailCode: code,
    providerStatus: status || null,
  });
}
export async function sendMail(job, fetcher = fetch, env = process.env) {
  env = mailConfig(env);
  let message;
  try {
    message = decodeMail(job, env);
  } catch {
    throw mailError("queue-decryption-failed");
  }
  message=filterMailRecipients(message,env);
  if(!message)return {providerId:null,blocked:true};
  let res;
  try {
    res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${String(env.RESEND_API_KEY || "").trim()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `fanta-mail/${job.id}`,
      },
      body: JSON.stringify({ from: env.MAIL_FROM, ...message }),
    });
  } catch {
    throw mailError("provider-connection-failed");
  }
  recordExternal("Resend", "/emails", res.status);
  let result = {};
  try {
    result = await res.json();
  } catch {}
  if (!res.ok) {
    const code =
      typeof result.name === "string" && /^[a-z_]{1,60}$/.test(result.name)
        ? result.name
        : "provider-rejected";
    throw mailError(code, res.status);
  }
  return {
    providerId:
      typeof result.id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(result.id)
        ? result.id
        : null,
  };
}
