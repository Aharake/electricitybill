import express from "express";
import { getDb, save, reload } from "../lib/store.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(getDb().settings);
});

router.put("/", async (req, res) => {
  const db = getDb();
  const { exchangeRate } = req.body;
  const rate = Number(exchangeRate);
  if (!Number.isNaN(rate) && rate > 0) {
    db.settings.exchangeRate = rate;
    await save();
  }
  res.json(db.settings);
});

router.post("/save", async (req, res) => {
  await save();
  res.json({ message: "Saved." });
});

router.post("/load", async (req, res) => {
  const db = await reload();
  res.json(db.settings);
});

export default router;
