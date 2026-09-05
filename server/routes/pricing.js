import express from "express";
import { getDb, save } from "../lib/excelStore.js";
import { liraToUsd, usdToLira } from "../lib/calc.js";
import { DEFAULT_PRICING_USD, DEFAULT_THABET_USD, isThabetName } from "../lib/defaults.js";

const router = express.Router();

function tables(db, scope) {
  return scope === "thabet"
    ? { table: db.thabetPricing, byMonth: db.thabetPricingByMonth, key: "thabetPricing", byMonthKey: "thabetPricingByMonth" }
    : { table: db.pricing, byMonth: db.pricingByMonth, key: "pricing", byMonthKey: "pricingByMonth" };
}

function matchesScope(sub, scope) {
  const fullName = `${sub.name} ${sub.familyName || ""}`;
  return scope === "thabet" ? isThabetName(fullName) : !isThabetName(fullName);
}

router.get("/:scope/months", (req, res) => {
  const db = getDb();
  const scope = req.params.scope;
  const { byMonth } = tables(db, scope);
  const months = new Set(byMonth.map((r) => r.month));
  db.monthlyBills.forEach((r) => months.add(r.month));
  res.json([...months].sort().reverse());
});

router.get("/:scope", (req, res) => {
  const db = getDb();
  const scope = req.params.scope;
  const { month } = req.query;
  const { table, byMonth } = tables(db, scope);
  const rate = db.settings.exchangeRate;

  let rows;
  if (month) {
    const overrides = byMonth.filter((r) => r.month === month);
    if (overrides.length) {
      rows = overrides.map((r) => ({ amps: r.amps, priceUsd: r.priceUsd }));
    } else {
      rows = table.map((r) => ({ ...r }));
    }
  } else {
    rows = table.map((r) => ({ ...r }));
  }
  rows = rows.map((r) => ({ amps: r.amps, priceLira: usdToLira(r.priceUsd, rate) }));
  rows.sort((a, b) => a.amps - b.amps);
  res.json(rows);
});

router.put("/:scope", (req, res) => {
  const db = getDb();
  const scope = req.params.scope;
  const { month, rows } = req.body;
  const rate = db.settings.exchangeRate;
  const usdRows = rows.map((r) => ({ amps: Number(r.amps), priceUsd: liraToUsd(r.priceLira, rate) }));

  if (month) {
    db.thabetPricingByMonth = db.thabetPricingByMonth; // no-op keep shape
    if (scope === "thabet") {
      db.thabetPricingByMonth = db.thabetPricingByMonth.filter((r) => r.month !== month);
      usdRows.forEach((r) => db.thabetPricingByMonth.push({ month, ...r }));
    } else {
      db.pricingByMonth = db.pricingByMonth.filter((r) => r.month !== month);
      usdRows.forEach((r) => db.pricingByMonth.push({ month, ...r }));
    }
    db.monthlyBills
      .filter((r) => r.month === month)
      .forEach((r) => {
        const sub = db.subscribers.find((s) => s.id === r.subscriberId);
        if (!sub || !matchesScope(sub, scope)) return;
        const override = usdRows.find((u) => u.amps === Number(sub.amps));
        if (override) r.subscriptionFeeUsd = override.priceUsd;
      });
  } else {
    if (scope === "thabet") db.thabetPricing = usdRows;
    else db.pricing = usdRows;
    db.monthlyBills.forEach((r) => {
      const sub = db.subscribers.find((s) => s.id === r.subscriberId);
      if (!sub || !matchesScope(sub, scope)) return;
      const override = usdRows.find((u) => u.amps === Number(sub.amps));
      if (override) r.subscriptionFeeUsd = override.priceUsd;
    });
  }
  save();
  res.json({ ok: true });
});

router.post("/:scope/add", (req, res) => {
  const db = getDb();
  const scope = req.params.scope;
  const amps = Number(req.body.amps);
  if (Number.isNaN(amps)) return res.status(400).json({ error: "invalid amps" });
  const { table } = tables(db, scope);
  if (table.some((r) => Number(r.amps) === amps)) {
    return res.status(400).json({ error: "duplicate" });
  }
  table.push({ amps, priceUsd: 10 });
  save();
  res.json({ ok: true });
});

router.delete("/:scope/:amps", (req, res) => {
  const db = getDb();
  const scope = req.params.scope;
  const amps = Number(req.params.amps);
  if (scope === "thabet") db.thabetPricing = db.thabetPricing.filter((r) => Number(r.amps) !== amps);
  else db.pricing = db.pricing.filter((r) => Number(r.amps) !== amps);
  save();
  res.json({ ok: true });
});

router.post("/:scope/reset", (req, res) => {
  const db = getDb();
  const scope = req.params.scope;
  if (scope === "thabet") db.thabetPricing = DEFAULT_THABET_USD.map((p) => ({ ...p }));
  else db.pricing = DEFAULT_PRICING_USD.map((p) => ({ ...p }));
  save();
  res.json({ ok: true });
});

export default router;
