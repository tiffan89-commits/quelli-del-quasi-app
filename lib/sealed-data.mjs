import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {fail} from './game.mjs';
function secretKey(env) {
  const key =
    env.MAIL_ENCRYPTION_KEY ||
    env.RESEND_API_KEY;
  if (!key)
    fail("Chiave di cifratura non disponibile", 503);
  return createHash("sha256")
    .update("quasi:sealed-data:v1:" + key)
    .digest();
}
export function sealSession(value, binding, env = process.env) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", secretKey(env), iv);
  cipher.setAAD(Buffer.from(binding));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), body]
    .map((x) => x.toString("base64url"))
    .join(".");
}
export function openSession(value, binding, env = process.env) {
  try {
    const [iv, tag, body] = value
        .split(".")
        .map((x) => Buffer.from(x, "base64url")),
      dec = createDecipheriv("aes-256-gcm", secretKey(env), iv);
    dec.setAAD(Buffer.from(binding));
    dec.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([dec.update(body), dec.final()]).toString("utf8"),
    );
  } catch {
    fail("Firma non valida o scaduta", 401);
  }
}
