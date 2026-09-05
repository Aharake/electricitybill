import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_RATE, DEFAULT_PRICING_USD, DEFAULT_THABET_USD, BILLING_TYPES } from "./defaults.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "data.xlsx");

const SHEETS = [
  "Settings",
  "Subscribers",
  "MonthlyBills",
  "Pricing",
  "PricingByMonth",
  "ThabetPricing",
  "ThabetPricingByMonth",
];

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

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const db = defaultDb();
    writeWorkbook(db);
  }
}

function sheetToRows(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

function readWorkbook() {
  ensureDataFile();
  const wb = XLSX.readFile(DATA_FILE);
  const db = defaultDb();

  const settingsRows = sheetToRows(wb, "Settings");
  if (settingsRows.length) {
    db.settings.exchangeRate = Number(settingsRows[0].exchangeRate) || DEFAULT_RATE;
    db.settings.currentMonth = settingsRows[0].currentMonth || todayMonth();
  }

  db.subscribers = sheetToRows(wb, "Subscribers").map((r) => ({
    id: Number(r.id),
    name: r.name || "",
    familyName: r.familyName || "",
    fatherName: r.fatherName || "",
    phone: r.phone || "",
    box: r.box == null ? "" : String(r.box),
    amps: Number(r.amps) || 0,
    securityDepositUsd: Number(r.securityDepositUsd) || 0,
    billingType: r.billingType || "METER",
  }));

  db.monthlyBills = sheetToRows(wb, "MonthlyBills").map((r) => ({
    id: Number(r.id),
    month: r.month,
    subscriberId: Number(r.subscriberId),
    prev: Number(r.prev) || 0,
    curr: Number(r.curr) || 0,
    pricePerAmpUsd: Number(r.pricePerAmpUsd) || 0,
    subscriptionFeeUsd: Number(r.subscriptionFeeUsd) || 0,
    discountUsd: Number(r.discountUsd) || 0,
    lastDebtUsd: Number(r.lastDebtUsd) || 0,
    paidUsd: Number(r.paidUsd) || 0,
    printedAt: r.printedAt || null,
  }));

  db.pricing = sheetToRows(wb, "Pricing").map((r) => ({ amps: Number(r.amps), priceUsd: Number(r.priceUsd) }));
  if (!db.pricing.length) db.pricing = DEFAULT_PRICING_USD.map((p) => ({ ...p }));

  db.pricingByMonth = sheetToRows(wb, "PricingByMonth").map((r) => ({
    month: r.month,
    amps: Number(r.amps),
    priceUsd: Number(r.priceUsd),
  }));

  db.thabetPricing = sheetToRows(wb, "ThabetPricing").map((r) => ({ amps: Number(r.amps), priceUsd: Number(r.priceUsd) }));
  if (!db.thabetPricing.length) db.thabetPricing = DEFAULT_THABET_USD.map((p) => ({ ...p }));

  db.thabetPricingByMonth = sheetToRows(wb, "ThabetPricingByMonth").map((r) => ({
    month: r.month,
    amps: Number(r.amps),
    priceUsd: Number(r.priceUsd),
  }));

  // Empty-Excel seeding rule (screen 3): seed demo subscribers if none exist
  if (!db.subscribers.length) {
    db.subscribers = seedDemoSubscribers();
  }

  return db;
}

function writeWorkbook(db) {
  const wb = XLSX.utils.book_new();

  const settingsSheet = XLSX.utils.json_to_sheet([{ ...db.settings }]);
  XLSX.utils.book_append_sheet(wb, settingsSheet, "Settings");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.subscribers), "Subscribers");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.monthlyBills), "MonthlyBills");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.pricing), "Pricing");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.pricingByMonth), "PricingByMonth");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.thabetPricing), "ThabetPricing");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.thabetPricingByMonth), "ThabetPricingByMonth");

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  XLSX.writeFile(wb, DATA_FILE);
}

let db = readWorkbook();

export function getDb() {
  return db;
}

export function reload() {
  db = readWorkbook();
  return db;
}

export function save() {
  writeWorkbook(db);
  return true;
}

export function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
}
