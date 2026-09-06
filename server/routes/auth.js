import express from "express";
import { signToken, timingSafeEqual, requireAuth } from "../lib/auth.js";

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = process.env.AUTH_USERNAME;
  const expectedPass = process.env.AUTH_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return res.status(500).json({ error: "AUTH_USERNAME/AUTH_PASSWORD not configured on the server" });
  }
  if (!username || !password) {
    return res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور" });
  }

  const userOk = timingSafeEqual(username, expectedUser);
  const passOk = timingSafeEqual(password, expectedPass);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  }

  res.json({ token: signToken(username) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ username: req.user });
});

export default router;
