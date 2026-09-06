// One-off maintenance endpoint: upload the legacy Excel workbook straight to
// a deployed server's database, without shell/file access to the container.
// Protected by ADMIN_TOKEN — unset means the route always refuses, so it's
// safe to leave mounted.
import express from "express";
import multer from "multer";
import { getDb } from "../lib/store.js";
import { importLegacyExcel } from "../lib/importLegacyExcel.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || provided !== token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

router.post("/import", requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file uploaded (field name: file)" });
  try {
    const result = await importLegacyExcel(getDb(), req.file.buffer);
    res.json({ message: "تم الاستيراد بنجاح", ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
