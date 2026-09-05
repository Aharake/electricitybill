// Imports subscriber + first-month billing data from the user's legacy
// hand-kept workbook into this app's data.xlsx.
//
// Usage: node scripts/importExcel.js "C:\path\to\source.xlsx"

import { getDb } from "../lib/excelStore.js";
import { importLegacyExcel } from "../lib/importLegacyExcel.js";

const SOURCE = process.argv[2];
if (!SOURCE) {
  console.error("Usage: node scripts/importExcel.js <path-to-source.xlsx>");
  process.exit(1);
}

const result = importLegacyExcel(getDb(), SOURCE);
console.log(`Imported ${result.imported} subscribers with ${result.monthKey} billing data (skipped ${result.skipped} blank rows).`);
console.log(`Exchange rate set to ${result.rate}. Current month set to ${result.monthKey}.`);
