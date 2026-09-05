import express from "express";
import { getDb, save, nextId } from "../lib/excelStore.js";
import { liraToUsd, subscriptionFeeFor, computeRecord, addMonths } from "../lib/calc.js";

const router = express.Router();

router.get("/", (req, res) => {
  const db = getDb();
  res.json(db.subscribers);
});

router.get("/counts", (req, res) => {
  const db = getDb();
  const counts = db.subscribers.map((s) => ({
    id: s.id,
    name: `${s.name} ${s.familyName || ""}`.trim(),
    monthlyRowCount: db.monthlyBills.filter((r) => r.subscriberId === s.id).length,
  }));
  res.json(counts);
});

router.post("/", (req, res) => {
  const db = getDb();
  const { name, familyName, fatherName, phone, box, amps, securityDepositLira, billingType } = req.body;
  if (!name || !familyName || !fatherName || !phone || box == null || box === "" || amps == null || amps === "") {
    return res.status(400).json({ error: "يرجى ملء جميع الحقول المطلوبة" });
  }
  const ampsNum = Number(amps);
  const depositLira = Number(securityDepositLira);
  if (Number.isNaN(ampsNum) || Number.isNaN(depositLira)) {
    return res.status(400).json({ error: "يرجى إدخال أرقام صحيحة" });
  }
  const sub = {
    id: nextId(db.subscribers),
    name,
    familyName,
    fatherName,
    phone,
    box: String(box),
    amps: ampsNum,
    securityDepositUsd: liraToUsd(depositLira, db.settings.exchangeRate),
    billingType: billingType || "METER",
  };
  db.subscribers.push(sub);
  save();
  res.json({ message: "تم إضافة المشترك بنجاح", subscriber: sub });
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const sub = db.subscribers.find((s) => s.id === id);
  if (!sub) return res.status(404).json({ error: "not found" });

  const { name, familyName, fatherName, phone, box, amps, securityDepositLira, billingType } = req.body;
  if (!name || !familyName || !fatherName || !phone || box == null || box === "" || amps == null || amps === "") {
    return res.status(400).json({ error: "يرجى ملء جميع الحقول المطلوبة" });
  }
  const ampsNum = Number(amps);
  const depositLira = Number(securityDepositLira);
  if (Number.isNaN(ampsNum) || Number.isNaN(depositLira)) {
    return res.status(400).json({ error: "يرجى إدخال أرقام صحيحة" });
  }
  Object.assign(sub, {
    name,
    familyName,
    fatherName,
    phone,
    box: String(box),
    amps: ampsNum,
    securityDepositUsd: liraToUsd(depositLira, db.settings.exchangeRate),
    billingType: billingType || "METER",
  });
  save();
  res.json({ message: "تم تحديث المشترك بنجاح", subscriber: sub });
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const idx = db.subscribers.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  db.subscribers.splice(idx, 1);
  db.monthlyBills = db.monthlyBills.filter((r) => r.subscriberId !== id);
  save();
  res.json({ ok: true });
});

router.get("/:id/statement", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const sub = db.subscribers.find((s) => s.id === id);
  if (!sub) return res.status(404).json({ error: "not found" });
  const records = db.monthlyBills
    .filter((r) => r.subscriberId === id)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ ...r, ...computeRecord(sub, r) }));
  res.json({ subscriber: sub, records });
});

router.get("/:id/pay-months", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const sub = db.subscribers.find((s) => s.id === id);
  if (!sub) return res.status(404).json({ error: "not found" });
  const current = db.settings.currentMonth;
  const months = new Set([addMonths(current, -1), current, addMonths(current, 1)]);
  db.monthlyBills.filter((r) => r.subscriberId === id).forEach((r) => months.add(r.month));
  res.json([...months].sort());
});

router.post("/:id/pay", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const sub = db.subscribers.find((s) => s.id === id);
  if (!sub) return res.status(404).json({ error: "not found" });
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: "month required" });

  let record = db.monthlyBills.find((r) => r.subscriberId === id && r.month === month);
  if (!record) {
    const prior = db.monthlyBills
      .filter((r) => r.subscriberId === id && r.month < month)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    const lastCurr = prior ? (prior.curr || prior.prev) : 0;
    const lastRemaining = prior ? computeRecord(sub, prior).remaining : 0;
    record = {
      id: nextId(db.monthlyBills),
      month,
      subscriberId: id,
      prev: lastCurr,
      curr: lastCurr,
      pricePerAmpUsd: prior ? prior.pricePerAmpUsd : 0,
      subscriptionFeeUsd: subscriptionFeeFor(db, sub, month),
      discountUsd: 0,
      lastDebtUsd: lastRemaining,
      paidUsd: 0,
      printedAt: null,
    };
    db.monthlyBills.push(record);
    save();
  }
  res.json({ record: { ...record, ...computeRecord(sub, record) }, subscriber: sub });
});

export default router;
