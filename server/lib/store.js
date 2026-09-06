// In-memory cache over Postgres. Routes read the in-memory `db` object
// synchronously (via getDb()) exactly as before; every mutating route then
// calls `await save()`, which persists the whole in-memory state back to
// Postgres in one transaction. This keeps every route file's shape unchanged
// while swapping the actual storage backend from a local data.xlsx file to a
// real database.
import { getPool, withTransaction, bulkInsert, ensureSchema } from "./db.js";
import { DEFAULT_RATE, DEFAULT_PRICING_USD, DEFAULT_THABET_USD } from "./defaults.js";

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function seedDemoSubscribers() {
  return [
    { id: 1, name: "أحمد", familyName: "قاسم", fatherName: "علي", phone: "03111111", box: "1", amps: 5, securityDepositUsd: 0, billingType: "METER" },
    { id: 2, name: "منى", familyName: "درويش", fatherName: "خالد", phone: "03222222", box: "2", amps: 10, securityDepositUsd: 0, billingType: "METER" },
    { id: 3, name: "خالد", familyName: "يوسف", fatherName: "محمود", phone: "03333333", box: "3", amps: 5, securityDepositUsd: 0, billingType: "FIXED" },
  ];
}

function defaultDb() {
  return {
    settings: { exchangeRate: DEFAULT_RATE, currentMonth: todayMonth() },
    subscribers: [],
    monthlyBills: [],
    pricing: DEFAULT_PRICING_USD.map((p) => ({ ...p })),
    pricingByMonth: [],
    thabetPricing: DEFAULT_THABET_USD.map((p) => ({ ...p })),
    thabetPricingByMonth: [],
  };
}

function rowToSubscriber(r) {
  return {
    id: Number(r.id),
    name: r.name || "",
    familyName: r.family_name || "",
    fatherName: r.father_name || "",
    phone: r.phone || "",
    box: r.box || "",
    amps: Number(r.amps) || 0,
    securityDepositUsd: Number(r.security_deposit_usd) || 0,
    billingType: r.billing_type || "METER",
  };
}

function rowToBill(r) {
  return {
    id: Number(r.id),
    month: r.month,
    subscriberId: Number(r.subscriber_id),
    prev: Number(r.prev) || 0,
    curr: Number(r.curr) || 0,
    pricePerAmpUsd: Number(r.price_per_amp_usd) || 0,
    subscriptionFeeUsd: Number(r.subscription_fee_usd) || 0,
    discountUsd: Number(r.discount_usd) || 0,
    lastDebtUsd: Number(r.last_debt_usd) || 0,
    paidUsd: Number(r.paid_usd) || 0,
    printedAt: r.printed_at ? new Date(r.printed_at).toISOString() : null,
  };
}

function rowToPrice(r) {
  return { amps: Number(r.amps), priceUsd: Number(r.price_usd) };
}

function rowToPriceByMonth(r) {
  return { month: r.month, amps: Number(r.amps), priceUsd: Number(r.price_usd) };
}

async function readAll() {
  // Sequential on one connection rather than 7 parallel pool connections —
  // kinder to managed Postgres free tiers with tight connection limits.
  const client = await getPool().connect();
  let settingsRes, subsRes, billsRes, pricingRes, pricingByMonthRes, thabetRes, thabetByMonthRes;
  try {
    settingsRes = await client.query("SELECT exchange_rate, current_month FROM settings WHERE id = 1");
    subsRes = await client.query("SELECT * FROM subscribers ORDER BY id");
    billsRes = await client.query("SELECT * FROM monthly_bills ORDER BY id");
    pricingRes = await client.query("SELECT * FROM pricing ORDER BY amps");
    pricingByMonthRes = await client.query("SELECT * FROM pricing_by_month ORDER BY month, amps");
    thabetRes = await client.query("SELECT * FROM thabet_pricing ORDER BY amps");
    thabetByMonthRes = await client.query("SELECT * FROM thabet_pricing_by_month ORDER BY month, amps");
  } finally {
    client.release();
  }

  const next = defaultDb();
  if (settingsRes.rows.length) {
    next.settings.exchangeRate = Number(settingsRes.rows[0].exchange_rate) || DEFAULT_RATE;
    next.settings.currentMonth = settingsRes.rows[0].current_month || todayMonth();
  }
  next.subscribers = subsRes.rows.map(rowToSubscriber);
  next.monthlyBills = billsRes.rows.map(rowToBill);
  next.pricing = pricingRes.rows.length ? pricingRes.rows.map(rowToPrice) : DEFAULT_PRICING_USD.map((p) => ({ ...p }));
  next.pricingByMonth = pricingByMonthRes.rows.map(rowToPriceByMonth);
  next.thabetPricing = thabetRes.rows.length ? thabetRes.rows.map(rowToPrice) : DEFAULT_THABET_USD.map((p) => ({ ...p }));
  next.thabetPricingByMonth = thabetByMonthRes.rows.map(rowToPriceByMonth);

  // Empty-database seeding rule (screen 3): seed demo subscribers if none exist.
  // Purely in-memory until the next save() actually persists them.
  if (!next.subscribers.length) {
    next.subscribers = seedDemoSubscribers();
  }

  return next;
}

let db = defaultDb();
let ready = ensureSchema().then(readAll).then((loaded) => {
  db = loaded;
});

export async function whenReady() {
  await ready;
}

export function getDb() {
  return db;
}

export async function reload() {
  db = await readAll();
  return db;
}

export async function save() {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM settings");
    await client.query("INSERT INTO settings (id, exchange_rate, current_month) VALUES (1,$1,$2)", [
      db.settings.exchangeRate,
      db.settings.currentMonth,
    ]);

    await client.query("DELETE FROM subscribers");
    await bulkInsert(
      client,
      "subscribers",
      ["id", "name", "family_name", "father_name", "phone", "box", "amps", "security_deposit_usd", "billing_type"],
      db.subscribers.map((s) => ({
        id: s.id, name: s.name, family_name: s.familyName, father_name: s.fatherName,
        phone: s.phone, box: s.box, amps: s.amps, security_deposit_usd: s.securityDepositUsd,
        billing_type: s.billingType,
      }))
    );

    await client.query("DELETE FROM monthly_bills");
    await bulkInsert(
      client,
      "monthly_bills",
      ["id", "month", "subscriber_id", "prev", "curr", "price_per_amp_usd", "subscription_fee_usd", "discount_usd", "last_debt_usd", "paid_usd", "printed_at"],
      db.monthlyBills.map((r) => ({
        id: r.id, month: r.month, subscriber_id: r.subscriberId, prev: r.prev, curr: r.curr,
        price_per_amp_usd: r.pricePerAmpUsd, subscription_fee_usd: r.subscriptionFeeUsd,
        discount_usd: r.discountUsd, last_debt_usd: r.lastDebtUsd, paid_usd: r.paidUsd,
        printed_at: r.printedAt,
      }))
    );

    await client.query("DELETE FROM pricing");
    await bulkInsert(client, "pricing", ["amps", "price_usd"], db.pricing.map((p) => ({ amps: p.amps, price_usd: p.priceUsd })));

    await client.query("DELETE FROM pricing_by_month");
    await bulkInsert(client, "pricing_by_month", ["month", "amps", "price_usd"], db.pricingByMonth.map((p) => ({ month: p.month, amps: p.amps, price_usd: p.priceUsd })));

    await client.query("DELETE FROM thabet_pricing");
    await bulkInsert(client, "thabet_pricing", ["amps", "price_usd"], db.thabetPricing.map((p) => ({ amps: p.amps, price_usd: p.priceUsd })));

    await client.query("DELETE FROM thabet_pricing_by_month");
    await bulkInsert(client, "thabet_pricing_by_month", ["month", "amps", "price_usd"], db.thabetPricingByMonth.map((p) => ({ month: p.month, amps: p.amps, price_usd: p.priceUsd })));
  });
  return true;
}

export function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
}
