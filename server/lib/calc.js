import { isThabetName } from "./defaults.js";

export function usdToLira(usd, rate) {
  return Math.round((Number(usd) || 0) * rate);
}

export function liraToUsd(lira, rate) {
  return (Number(lira) || 0) / rate;
}

export function formatLira(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("en-US");
}

// Find subscription price (USD) for a given amp level, preferring an exact month override.
export function findPrice(table, tableByMonth, month, amps) {
  if (month) {
    const override = tableByMonth.find((r) => r.month === month && Number(r.amps) === Number(amps));
    if (override) return override.priceUsd;
  }
  const base = table.find((r) => Number(r.amps) === Number(amps));
  return base ? base.priceUsd : 0;
}

export function subscriptionFeeFor(db, subscriber, month) {
  if (subscriber.billingType === "FREE") return 0;
  if (isThabetName(`${subscriber.name} ${subscriber.familyName || ""}`)) {
    return findPrice(db.thabetPricing, db.thabetPricingByMonth, month, subscriber.amps);
  }
  return findPrice(db.pricing, db.pricingByMonth, month, subscriber.amps);
}

// Core bill computation for a single monthly record (all USD in/out).
export function computeRecord(subscriber, record) {
  const prev = Number(record.prev) || 0;
  const curr = Number(record.curr) || 0;
  const used = Math.max(0, curr - prev);
  const price = Number(record.pricePerAmpUsd) || 0;
  const fee = Number(record.subscriptionFeeUsd) || 0;
  const discount = Number(record.discountUsd) || 0;
  const lastDebt = Number(record.lastDebtUsd) || 0;
  const amps = Number(subscriber.amps) || 0;
  const paid = Number(record.paidUsd) || 0;
  const depositDue = subscriber.securityDepositUsd < 0 ? -subscriber.securityDepositUsd : 0;

  let value;
  let total;

  if (subscriber.billingType === "FIXED") {
    value = amps > 0 ? (fee / amps) * 100 - discount : -discount;
    total = value + lastDebt + depositDue;
  } else if (subscriber.billingType === "FREE") {
    value = 0;
    total = lastDebt - discount + depositDue;
  } else {
    // METER
    value = used * price - discount;
    total = value + fee + lastDebt + depositDue;
  }

  total = Math.max(0, total);
  const remaining = Math.max(0, total - paid);
  let status;
  if (paid <= 0) status = "غير مدفوع";
  else if (remaining <= 0.0001) status = "مدفوع";
  else status = "مدفوع جزئياً";

  return { used, value, total, paid, remaining, status };
}

function monthKey(m) {
  return m; // yyyy-MM sorts lexicographically
}

export function addMonths(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Recompute forward from (and including) fromMonth for one subscriber, carrying
// prev/lastDebt into each subsequent month that already has a record.
export function propagateForward(db, subscriberId, fromMonth) {
  const subscriber = db.subscribers.find((s) => s.id === subscriberId);
  if (!subscriber) return;
  const records = db.monthlyBills
    .filter((r) => r.subscriberId === subscriberId)
    .sort((a, b) => monthKey(a.month).localeCompare(monthKey(b.month)));

  const startIdx = records.findIndex((r) => r.month === fromMonth);
  if (startIdx === -1) return;

  for (let i = startIdx; i < records.length; i++) {
    const rec = records[i];
    if (i > startIdx) {
      const prevRec = records[i - 1];
      const prevComputed = computeRecord(subscriber, prevRec);
      rec.prev = prevRec.curr === 0 ? prevRec.prev : prevRec.curr;
      rec.lastDebtUsd = prevComputed.remaining;
    }
  }
}

export function recomputeAndSave(db, record) {
  propagateForward(db, record.subscriberId, record.month);
}
