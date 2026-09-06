import jwt from "jsonwebtoken";
import crypto from "crypto";

const TOKEN_TTL = "7d";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set.");
  return secret;
}

export function signToken(username) {
  return jwt.sign({ sub: username }, getSecret(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

// Constant-time string compare so a wrong password can't be brute-forced via
// response-time differences.
export function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal length so failure here isn't itself a timing tell.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: "unauthorized" });
  req.user = payload.sub;
  next();
}
