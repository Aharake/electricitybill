import express from "express";
import { getDb, save, nextId } from "../lib/store.js";
import { computeRecord, subscriptionFeeFor, propagateForward, addMonths } from "../lib/calc.js";

const router = express.Router();
const MONTH_RE = /^\d{4}-\d{2}$/;

router.get("/", (req, res) => {
  const db = getDb();
  const { month } = req.query;
  if (!month || !MONTH_RE.test(month)) return res.json([]);
  const rows = db.monthlyBills
    .filter((r) => r.month === month)
    .map((r) => {
      const sub = db.subscribers.find((s) => s.id === r.subscriberId);
      return {
        id: r.id,
        subscriberId: r.subscriberId,
        box: sub?.box,
        name: sub?.name,
        familyName: sub?.familyName,
        fatherName: sub?.fatherName,
        prev: r.prev,
        curr: r.curr,
      };
    });
  res.json(rows);
});

router.post("/upsert", async (req, res) => {
  const db = getDb();
  const { month } = req.body;
  if (!month || !MONTH_RE.test(month)) return res.status(400).json({ error: "صيغة غير صحيحة (yyyy-MM)" });

  const prevMonth = addMonths(month, -1);
  for (const sub of db.subscribers) {
    if (db.monthlyBills.some((r) => r.subscriberId === sub.id && r.month === month)) continue;
    const prior = db.monthlyBills
      .filter((r) => r.subscriberId === sub.id && r.month <= prevMonth)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    const lastCurr = prior ? (prior.curr || prior.prev) : 0;
    const lastRemaining = prior ? computeRecord(sub, prior).remaining : 0;
    db.monthlyBills.push({
      id: nextId(db.monthlyBills),
      month,
      subscriberId: sub.id,
      prev: lastCurr,
      curr: lastCurr,
      pricePerAmpUsd: prior ? prior.pricePerAmpUsd : 0,
      subscriptionFeeUsd: subscriptionFeeFor(db, sub, month),
      discountUsd: 0,
      lastDebtUsd: lastRemaining,
      paidUsd: 0,
      printedAt: null,
    });
  }
  db.settings.currentMonth = month;
  await save();
  res.json({ message: `تم إنشاء/تحديث سجلات الشهر ${month}` });
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const record = db.monthlyBills.find((r) => r.id === id);
  if (!record) return res.status(404).json({ error: "not found" });
  record.curr = Number(req.body.curr) || 0;
  propagateForward(db, record.subscriberId, record.month);
  await save();
  res.json({ ok: true });
});

export default router;
