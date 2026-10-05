import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { utcTimestamp } from "./db.js";

const sessionAgeSeconds = 7 * 24 * 60 * 60;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${digest.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algorithm, n, r, p, saltHex, digestHex] = stored.split("$");
    if (algorithm !== "scrypt") return false;
    const expected = Buffer.from(digestHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(n), r: Number(r), p: Number(p)
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function equalSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

function cookieToken(req) {
  const pair = (req.headers.cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith("quizlink_session="));
  return pair ? pair.slice("quizlink_session=".length) : null;
}

function sessionCookie(token, maxAge) {
  const parts = [
    `quizlink_session=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`
  ];
  if (process.env.QUIZLINK_SECURE_COOKIES === "1") parts.push("Secure");
  return parts.join("; ");
}

export function createAuth(database) {
  function attach(req, _res, next) {
    const token = cookieToken(req);
    if (token) {
      const sessionId = createHash("sha256").update(token).digest("hex");
      const session = database.prepare(`
        SELECT s.session_id, s.csrf_token, s.user_id, u.email, u.display_name,
               u.bio, u.role, u.account_status
        FROM sessions s JOIN users u ON u.user_id=s.user_id
        WHERE s.session_id=? AND s.revoked_at IS NULL AND s.expires_at>?
              AND u.account_status='active'
      `).get(sessionId, utcTimestamp());
      if (session) {
        req.session = session;
        req.user = {
          userId: session.user_id, email: session.email, displayName: session.display_name,
          bio: session.bio, role: session.role, accountStatus: session.account_status
        };
      }
    }
    next();
  }

  function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Please log in." });
    next();
  }

  function requireCsrf(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Please log in." });
    if (!equalSecret(req.get("x-csrf-token"), req.session.csrf_token)) {
      return res.status(403).json({ error: "Invalid form token. Reload and try again." });
    }
    next();
  }

  function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Please log in." });
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    next();
  }

  function startSession(userId, res) {
    const token = randomBytes(32).toString("hex");
    const sessionId = createHash("sha256").update(token).digest("hex");
    const csrfToken = randomBytes(32).toString("hex");
    const expiresAt = utcTimestamp(new Date(Date.now() + sessionAgeSeconds * 1000));
    database.prepare("INSERT INTO sessions(session_id,user_id,csrf_token,expires_at) VALUES (?,?,?,?)")
      .run(sessionId, userId, csrfToken, expiresAt);
    res.setHeader("Set-Cookie", sessionCookie(token, sessionAgeSeconds));
    return csrfToken;
  }

  function endSession(req, res) {
    database.prepare("UPDATE sessions SET revoked_at=? WHERE session_id=?")
      .run(utcTimestamp(), req.session.session_id);
    res.setHeader("Set-Cookie", sessionCookie("", 0));
  }

  return { attach, requireAuth, requireCsrf, requireAdmin, startSession, endSession };
}
