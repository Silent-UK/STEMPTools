import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export const random = () => randomBytes(32).toString("base64url");
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export function cryptoBox(key) {
  if (!/^[a-f0-9]{64}$/i.test(key || ""))
    throw Error("ENCRYPTION_KEY must be 32 random bytes encoded as hex");
  const k = Buffer.from(key, "hex");
  return {
    seal(value) {
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", k, iv),
        body = Buffer.concat([
          cipher.update(JSON.stringify(value)),
          cipher.final(),
        ]);
      return [iv, cipher.getAuthTag(), body]
        .map((b) => b.toString("base64url"))
        .join(".");
    },
    open(value) {
      const [iv, tag, body] = value
        .split(".")
        .map((v) => Buffer.from(v, "base64url"));
      const d = createDecipheriv("aes-256-gcm", k, iv);
      d.setAuthTag(tag);
      return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString());
    },
  };
}
export function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim().split(/=(.*)/s))
      .filter((v) => v.length > 1)
      .map(([k, v]) => [k, v]),
  );
}
export function assertOrigin(req, base) {
  if (req.headers.origin !== base)
    throw Object.assign(Error("Invalid request origin"), { status: 403 });
}
