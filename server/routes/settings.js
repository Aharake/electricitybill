import express from "express";
import { getDb, save, reload } from "../lib/excelStore.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(getDb().settings);
});

router.put("/", (req, res) => {
  const db = getDb();
  const { exchangeRate } = req.body;
  const rate = Number(exchangeRate);
  if (!Number.isNaN(rate) && rate > 0) {
    db.settings.exchangeRate = rate;
    save();
  }
  res.json(db.settings);
});

router.post("/save", (req, res) => {
  save();
  res.json({ message: "Saved to Excel." });
});

router.post("/load", (req, res) => {
  const db = reload();
  res.json(db.settings);
});

export default router;
