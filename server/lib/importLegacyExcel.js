// Shared import logic for the user's legacy hand-kept workbook ("الاشتراكات"
// sheet, one repeating 13-column block per month). Used by both the local CLI
// script (scripts/importExcel.js) and the protected HTTP upload endpoint
// (routes/admin.js) so a redeploy can be re-seeded with real data without
// filesystem access to the production machine.
import XLSX from "xlsx";
import { save } from "./store.js";

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

const COL = {
  meterNo: 0, name: 1, father: 2, family: 3, phone: 4, amps: 5,
  box: 8, openingBalance: 9, prevMeter: 10, remainingBalance: 11,
  monthLabel: 12, curr: 13, price: 15, fee: 16,
  lastDebt: 19, paidUsd: 21, paidLira: 22,
};

export async function importLegacyExcel(db, workbookInput) {
  const wb = Buffer.isBuffer(workbookInput)
    ? XLSX.read(workbookInput, { type: "buffer" })
    : XLSX.readFile(workbookInput);

  const ws = wb.Sheets["الاشتراكات"];
  if (!ws) throw new Error('Sheet "الاشتراكات" not found in source file.');
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  const rateCell = aoa[5]?.[17]; // R6
  const rate = Number(rateCell) || 89500;
  const priceCellRaw = aoa[5]?.[15]; // P6
  const monthLabel = aoa[9]?.[COL.monthLabel];
  const monthKey = MONTH_MAP[monthLabel] ? `${YEAR}-${MONTH_MAP[monthLabel]}` : "2026-07";

  db.subscribers = [];
  db.monthlyBills = [];
  db.settings.exchangeRate = rate;
  db.settings.currentMonth = monthKey;

  let nextSubId = 1;
  let nextBillId = 1;
  let imported = 0;
  let skipped = 0;

  for (let r = 9; r <= 333; r++) {
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

    const prev = Number(row[COL.prevMeter]) || 0;
    const curr = Number(row[COL.curr]) || 0;
    const priceLiraRaw = row[COL.price] != null ? Number(row[COL.price]) : Number(priceCellRaw) || 0;
    const feeLira = Number(row[COL.fee]) || 0;
    const lastDebtUsd = Number(row[COL.remainingBalance]) || 0;
    const paidUsd = (Number(row[COL.paidUsd]) || 0) + (Number(row[COL.paidLira]) || 0) / rate;

    db.monthlyBills.push({
      id: nextBillId++,
      month: monthKey,
      subscriberId: sub.id,
      prev,
      curr,
      pricePerAmpUsd: priceLiraRaw / rate,
      subscriptionFeeUsd: feeLira / rate,
      discountUsd: 0,
      lastDebtUsd,
      paidUsd,
      printedAt: null,
    });

    imported++;
  }

  await save();

  return { imported, skipped, monthKey, rate };
}
