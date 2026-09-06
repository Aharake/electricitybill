// In-app "استيراد من Excel" button — same import as the CLI script and the
// ADMIN_TOKEN-gated /api/admin/import, but reachable by anyone already
// logged in (mounted after the requireAuth gate in index.js).
import express from "express";
import multer from "multer";
import { getDb } from "../lib/store.js";
import { importLegacyExcel } from "../lib/importLegacyExcel.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file uploaded (field name: file)" });
  try {
    const result = await importLegacyExcel(getDb(), req.file.buffer);
    res.json({ message: "تم استيراد جميع البيانات بنجاح", ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
