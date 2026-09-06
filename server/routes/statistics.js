import express from "express";
import { getDb } from "../lib/store.js";
import { computeRecord, usdToLira } from "../lib/calc.js";

const router = express.Router();

router.get("/months", (req, res) => {
  const db = getDb();
  const months = [...new Set(db.monthlyBills.map((r) => r.month))].sort().reverse();
  res.json(months);
});

router.get("/", (req, res) => {
  const db = getDb();
  const { month } = req.query;
  const rate = db.settings.exchangeRate;
  const rows = db.monthlyBills
    .filter((r) => r.month === month)
    .map((r) => {
      const sub = db.subscribers.find((s) => s.id === r.subscriberId);
      return { record: r, sub, computed: sub ? computeRecord(sub, r) : null };
    })
    .filter((x) => x.computed);

  if (!rows.length) {
    return res.json({
      totalSubscribers: 0,
      totalRevenueLira: 0,
      collectedLira: 0,
      remainingLira: 0,
      fullyPaid: 0,
      partiallyPaid: 0,
      unpaid: 0,
      collectionRate: 0,
      totalUsedAmps: 0,
      avgUsedAmps: 0,
      maxUsedAmps: 0,
      totalDiscountLira: 0,
      totalLastDebtLira: 0,
      avgBillLira: 0,
    });
  }

  const totalBilled = rows.reduce((s, x) => s + x.computed.total, 0);
  const totalPaid = rows.reduce((s, x) => s + x.computed.paid, 0);
  const totalRemaining = rows.reduce((s, x) => s + x.computed.remaining, 0);
  const totalDiscount = rows.reduce((s, x) => s + (x.record.discountUsd || 0), 0);
  const totalLastDebt = rows.reduce((s, x) => s + (x.record.lastDebtUsd || 0), 0);
  const usedList = rows.map((x) => x.computed.used);
  const totalUsed = usedList.reduce((s, u) => s + u, 0);

  res.json({
    totalSubscribers: rows.length,
    totalRevenueLira: usdToLira(totalBilled, rate),
    collectedLira: usdToLira(totalPaid, rate),
    remainingLira: usdToLira(totalRemaining, rate),
    fullyPaid: rows.filter((x) => x.computed.status === "مدفوع").length,
    partiallyPaid: rows.filter((x) => x.computed.status === "مدفوع جزئياً").length,
    unpaid: rows.filter((x) => x.computed.status === "غير مدفوع").length,
    collectionRate: totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0,
    totalUsedAmps: totalUsed,
    avgUsedAmps: totalUsed / rows.length,
    maxUsedAmps: Math.max(...usedList),
    totalDiscountLira: usdToLira(totalDiscount, rate),
    totalLastDebtLira: usdToLira(totalLastDebt, rate),
    avgBillLira: usdToLira(totalBilled / rows.length, rate),
  });
});

export default router;
