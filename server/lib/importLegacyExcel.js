// Shared import logic for the user's legacy hand-kept workbook ("الاشتراكات"
// sheet, one repeating 13-column block per month, side by side). Used by
// both the local CLI script (scripts/importExcel.js) and the protected HTTP
// upload endpoint (routes/admin.js and the in-app "استيراد من Excel" button)
// so the app can be re-seeded with real data without filesystem access to
// wherever it's actually running.
import XLSX from "xlsx";
import { save } from "./store.js";
import { propagateForward, addMonths } from "./calc.js";

const MONTH_MAP = {
  "كانون الثاني": "01", "كانون 2": "01",
  "شباط": "02",
  "آذار": "03", "أذار": "03", "اذار": "03",
  "نيسان": "04",
  "أيار": "05", "ايار": "05",
  "حزيران": "06",
  "تموز": "07",
  "آب": "08", "اب": "08",
  "أيلول": "09", "ايلول": "09",
  "تشرين الأول": "10", "تشرين 1": "10",
  "تشرين الثاني": "11", "تشرين 2": "11",
  "كانون الأول": "12", "كانون 1": "12",
};
const YEAR = "2026";
const HEADER_ROW = 8; // 0-indexed row 9
const FIRST_DATA_ROW = 9; // 0-indexed row 10
const LAST_DATA_ROW = 333; // 0-indexed row 334

// Fixed subscriber columns, before the repeating month blocks.
const COL = {
  meterNo: 0, name: 1, father: 2, family: 3, phone: 4, amps: 5,
  box: 8, prevMeter: 10, remainingBalance: 11,
};

// Offsets within each 13-column month block.
const BLOCK = { month: 0, curr: 1, price: 3, fee: 4, paidUsd: 9, paidLira: 10 };
const BLOCK_WIDTH = 13;

function findBlockStarts(headerRow) {
  const starts = [];
  headerRow.forEach((v, i) => {
    if (v === "الشهر") starts.push(i);
  });
  return starts;
}

export async function importLegacyExcel(db, workbookInput) {
  const wb = Buffer.isBuffer(workbookInput)
    ? XLSX.read(workbookInput, { type: "buffer" })
    : XLSX.readFile(workbookInput);

  const ws = wb.Sheets["الاشتراكات"];
  if (!ws) throw new Error('Sheet "الاشتراكات" not found in source file.');
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  const rate = Number(aoa[5]?.[17]) || 89500; // R6
  const blockStarts = findBlockStarts(aoa[HEADER_ROW] || []);
  if (!blockStarts.length) throw new Error('No month blocks ("الشهر" columns) found in the sheet.');

  // Determine each block's month key: read the first non-blank label found
  // in that block's column, falling back to (first block's month + offset)
  // for blocks where every row happens to be blank in that cell.
  let firstMonthKey = null;
  const monthKeys = blockStarts.map((start, i) => {
    let label = null;
    for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW && !label; r++) {
      const v = aoa[r]?.[start + BLOCK.month];
      if (v) label = v;
    }
    if (i === 0) {
      firstMonthKey = MONTH_MAP[label] ? `${YEAR}-${MONTH_MAP[label]}` : "2026-07";
      return firstMonthKey;
    }
    return label && MONTH_MAP[label] ? `${YEAR}-${MONTH_MAP[label]}` : addMonths(firstMonthKey, i);
  });

  db.subscribers = [];
  db.monthlyBills = [];
  db.settings.exchangeRate = rate;
  db.settings.currentMonth = monthKeys[monthKeys.length - 1];

  let nextSubId = 1;
  let nextBillId = 1;
  let imported = 0;
  let skipped = 0;
  let billsImported = 0;

  for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
    const row = aoa[r];
    if (!row) continue;
    const name = row[COL.name];
    if (!name || !String(name).trim()) {
      skipped++;
      continue;
    }

    const familyName = row[COL.family] ? String(row[COL.family]) : "";
    const fatherName = row[COL.father] ? String(row[COL.father]) : "";
    const phone = row[COL.phone] != null ? String(row[COL.phone]) : "";
    const amps = Number(row[COL.amps]) || 0;
    const box = row[COL.meterNo] != null && row[COL.meterNo] !== ""
      ? String(row[COL.meterNo])
      : (row[COL.box] != null ? String(row[COL.box]) : "");

    const sub = {
      id: nextSubId++,
      name: String(name),
      familyName,
      fatherName,
      phone,
      box,
      amps,
      securityDepositUsd: 0,
      billingType: "METER",
    };
    db.subscribers.push(sub);

    // First block also carries the meter's starting reading (K) and the
    // legacy opening balance (L) — everything before the app's own tracking
    // began. Later blocks chain forward from the previous block's own curr
    // reading, exactly like this app's own carry-forward, so prev/lastDebt
    // for blocks 2+ are left for propagateForward to compute below rather
    // than trusting the sheet's own (often-blank) per-block carry columns.
    const openingPrev = Number(row[COL.prevMeter]) || 0;
    const openingDebt = Number(row[COL.remainingBalance]) || 0;

    blockStarts.forEach((start, i) => {
      const curr = Number(row[start + BLOCK.curr]) || 0;
      const priceLira = Number(row[start + BLOCK.price]) || 0;
      const feeLira = Number(row[start + BLOCK.fee]) || 0;
      const paidUsd = (Number(row[start + BLOCK.paidUsd]) || 0) + (Number(row[start + BLOCK.paidLira]) || 0) / rate;

      db.monthlyBills.push({
        id: nextBillId++,
        month: monthKeys[i],
        subscriberId: sub.id,
        prev: i === 0 ? openingPrev : 0,
        curr,
        pricePerAmpUsd: priceLira / rate,
        subscriptionFeeUsd: feeLira / rate,
        discountUsd: 0,
        lastDebtUsd: i === 0 ? openingDebt : 0,
        paidUsd,
        printedAt: null,
      });
      billsImported++;
    });

    imported++;
  }

  // Chain prev/lastDebt forward through all imported months per subscriber,
  // using this app's own (reliable) calc engine rather than the sheet's.
  for (const sub of db.subscribers) {
    propagateForward(db, sub.id, monthKeys[0]);
  }

  await save();

  return { imported, skipped, billsImported, months: monthKeys, rate };
}
