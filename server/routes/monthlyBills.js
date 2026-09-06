import express from "express";
import { getDb, save, nextId } from "../lib/store.js";
import { computeRecord, subscriptionFeeFor, propagateForward, addMonths, liraToUsd } from "../lib/calc.js";

const router = express.Router();

function withComputed(db, record) {
  const sub = db.subscribers.find((s) => s.id === record.subscriberId);
  return { ...record, subscriber: sub, ...computeRecord(sub, record) };
}

router.get("/", (req, res) => {
  const db = getDb();
  const { month } = req.query;
  let rows = db.monthlyBills;
  if (month) rows = rows.filter((r) => r.month === month);
  res.json(rows.map((r) => withComputed(db, r)));
});

router.get("/months", (req, res) => {
  const db = getDb();
  const months = [...new Set(db.monthlyBills.map((r) => r.month))].sort().reverse();
  res.json(months);
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const record = db.monthlyBills.find((r) => r.id === id);
  if (!record) return res.status(404).json({ error: "not found" });
  const { curr, pricePerAmpLira, discountLira, paidLira, paidUsdInput, month } = req.body;
  const rate = db.settings.exchangeRate;

  if (month && month !== record.month) {
    const clash = db.monthlyBills.some((r) => r.subscriberId === record.subscriberId && r.month === month && r.id !== id);
    if (clash) return res.status(400).json({ error: "يوجد سجل بالفعل لهذا الشهر" });
    const oldMonth = record.month;
    record.month = month;
    propagateForward(db, record.subscriberId, oldMonth < month ? oldMonth : month);
  }

  if (curr != null) record.curr = Number(curr) || 0;
  if (pricePerAmpLira != null) record.pricePerAmpUsd = liraToUsd(pricePerAmpLira, rate);
  if (discountLira != null) record.discountUsd = liraToUsd(discountLira, rate);
  if (paidLira != null || paidUsdInput != null) {
    const fromLira = paidLira != null ? liraToUsd(paidLira, rate) : 0;
    const fromUsd = paidUsdInput != null ? Number(paidUsdInput) || 0 : 0;
    record.paidUsd = fromLira + fromUsd;
  }

  propagateForward(db, record.subscriberId, record.month);
  await save();
  res.json(withComputed(db, record));
});

router.post("/create", async (req, res) => {
  const db = getDb();
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: "month required" });

  db.monthlyBills = db.monthlyBills.filter((r) => r.month !== month);

  const prevMonth = addMonths(month, -1);
  for (const sub of db.subscribers) {
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
      pricePerAmpUsd: 0,
      subscriptionFeeUsd: subscriptionFeeFor(db, sub, month),
      discountUsd: 0,
      lastDebtUsd: lastRemaining,
      paidUsd: 0,
      printedAt: null,
    });
  }

  for (const sub of db.subscribers) propagateForward(db, sub.id, month);
  await save();
  res.json({ ok: true, count: db.subscribers.length });
});

router.post("/close", async (req, res) => {
  const db = getDb();
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: "month required" });
  const nextMonth = addMonths(month, 1);

  for (const sub of db.subscribers) {
    if (db.monthlyBills.some((r) => r.subscriberId === sub.id && r.month === nextMonth)) continue;
    const current = db.monthlyBills.find((r) => r.subscriberId === sub.id && r.month === month);
    const lastCurr = current ? (current.curr || current.prev) : 0;
    const lastRemaining = current ? computeRecord(sub, current).remaining : 0;
    db.monthlyBills.push({
      id: nextId(db.monthlyBills),
      month: nextMonth,
      subscriberId: sub.id,
      prev: lastCurr,
      curr: 0,
      pricePerAmpUsd: 0,
      subscriptionFeeUsd: subscriptionFeeFor(db, sub, nextMonth),
      discountUsd: 0,
      lastDebtUsd: lastRemaining,
      paidUsd: 0,
      printedAt: null,
    });
  }
  db.settings.currentMonth = nextMonth;
  await save();
  res.json({ ok: true, nextMonth });
});

router.post("/update-price", async (req, res) => {
  const db = getDb();
  const { month, priceLira } = req.body;
  if (!month) return res.status(400).json({ error: "month required" });
  const usd = liraToUsd(priceLira, db.settings.exchangeRate);
  db.monthlyBills.filter((r) => r.month === month).forEach((r) => (r.pricePerAmpUsd = usd));
  await save();
  res.json({ message: `تم تحديث السعر للشهر ${month}` });
});

router.post("/:id/print", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const record = db.monthlyBills.find((r) => r.id === id);
  if (!record) return res.status(404).json({ error: "not found" });
  record.printedAt = new Date().toISOString();
  await save();
  res.json(withComputed(db, record));
});

export default router;
