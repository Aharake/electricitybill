// One-off (user-requested) reset: wipe every month's billing data — prices,
// fees, discounts, debts, payments — while keeping the subscriber roster
// (name/family/father/phone/box/amps) and each subscriber's last known
// meter reading, so the next month can be filled in from a clean, correct
// starting point instead of carrying old imported money data forward.
import express from "express";
import { getDb, save, nextId } from "../lib/store.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const db = getDb();
  const { month } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "أدخل الشهر المطلوب البدء منه بصيغة yyyy-MM" });
  }

  // Preserve each subscriber's latest known meter reading before wiping.
  const lastReading = {};
  for (const sub of db.subscribers) {
    const theirs = db.monthlyBills
      .filter((r) => r.subscriberId === sub.id)
      .sort((a, b) => b.month.localeCompare(a.month));
    const atMonth = theirs.find((r) => r.month === month);
    const latest = theirs[0];
    lastReading[sub.id] = atMonth ? atMonth.prev : latest ? (latest.curr || latest.prev) : 0;
    sub.securityDepositUsd = 0; // deposit is money data too
  }

  db.monthlyBills = [];
  for (const sub of db.subscribers) {
    const prev = lastReading[sub.id] || 0;
    db.monthlyBills.push({
      id: nextId(db.monthlyBills),
      month,
      subscriberId: sub.id,
      prev,
      curr: prev,
      pricePerAmpUsd: 0,
      subscriptionFeeUsd: 0,
      discountUsd: 0,
      lastDebtUsd: 0,
      paidUsd: 0,
      printedAt: null,
    });
  }
  db.settings.currentMonth = month;
  await save();

  res.json({
    message: `تم تصفير البيانات المالية والاحتفاظ ببيانات المشتركين وقراءاتهم السابقة. الشهر الحالي الآن: ${month}`,
    subscribers: db.subscribers.length,
    month,
  });
});

export default router;
