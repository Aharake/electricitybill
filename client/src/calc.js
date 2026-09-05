// Client-side mirror of server/lib/calc.js computeRecord, for live UI feedback.
export function computeRecord(subscriber, record) {
  const prev = Number(record.prev) || 0;
  const curr = Number(record.curr) || 0;
  const used = Math.max(0, curr - prev);
  const price = Number(record.pricePerAmpUsd) || 0;
  const fee = Number(record.subscriptionFeeUsd) || 0;
  const discount = Number(record.discountUsd) || 0;
  const lastDebt = Number(record.lastDebtUsd) || 0;
  const amps = Number(subscriber?.amps) || 0;
  const paid = Number(record.paidUsd) || 0;
  const depositDue = subscriber?.securityDepositUsd < 0 ? -subscriber.securityDepositUsd : 0;

  let value;
  let total;

  if (subscriber?.billingType === "FIXED") {
    value = amps > 0 ? (fee / amps) * 100 - discount : -discount;
    total = value + lastDebt + depositDue;
  } else if (subscriber?.billingType === "FREE") {
    value = 0;
    total = lastDebt - discount + depositDue;
  } else {
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
