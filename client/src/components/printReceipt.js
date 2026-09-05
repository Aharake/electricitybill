const FIXED_RATE = 89000;

function fmt(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

function fmtDate(d) {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function openPrintWindow(record, subscriber) {
  const rate = FIXED_RATE;
  const now = new Date();
  const usedKwh = record.used;
  const priceLira = fmt(record.pricePerAmpUsd * rate);
  const usageValueLira = fmt(record.used * record.pricePerAmpUsd * rate);
  const feeLira = fmt(record.subscriptionFeeUsd * rate);
  const valueLira = fmt(record.value * rate);
  const discountLira = fmt(record.discountUsd * rate);
  const lastDebtLira = fmt(record.lastDebtUsd * rate);
  const printedTotalUsd = record.total - record.discountUsd;
  const printedTotalLira = fmt(printedTotalUsd * rate);
  const paidLira = fmt(record.paid * rate);
  const remainingLira = fmt(record.remaining * rate);

  let rightSection = "";
  if (subscriber.billingType === "METER") {
    rightSection = `
      <div class="row"><span>نوع الأشتراك:</span><b>عداد</b></div>
      <div class="row"><span>سعر الكيلوواط:</span><b>${priceLira} ل.ل</b></div>
      <div class="row"><span>قيمة الاستهلاك:</span><b>${usageValueLira} ل.ل</b></div>
      <div class="row"><span>اشتراك الأمبير:</span><b>${subscriber.amps}</b></div>
      <div class="row"><span>رسم الاشتراك:</span><b>${feeLira} ل.ل</b></div>
    `;
  } else if (subscriber.billingType === "FIXED") {
    rightSection = `
      <div class="row"><span>نوع الأشتراك:</span><b>ثابت</b></div>
      <div class="row"><span>المبلغ:</span><b>${valueLira} ل.ل</b></div>
      <div class="row"><span>اشتراك الأمبير:</span><b>${subscriber.amps}</b></div>
      <div class="row"><span>رسم الاشتراك:</span><b>${feeLira} ل.ل</b></div>
    `;
  } else {
    rightSection = `<div class="row"><span>نوع الأشتراك:</span><b>مجاني</b></div>`;
  }

  const discountRow = record.discountUsd > 0 ? `<div class="row"><span>خصومات:</span><b>${discountLira} ل.ل</b></div>` : "";
  const depositRow = subscriber.securityDepositUsd < 0
    ? `<div class="row"><span>تأمين:</span><b>${fmt(-subscriber.securityDepositUsd * rate)} ل.ل</b></div>`
    : "";

  const html = `
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>إيصال اشتراك كهرباء</title>
<style>
  @page { size: A5 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; background: #fff; color: #000; margin: 0; padding: 12px; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 10px; }
  .meta { text-align: center; font-size: 12px; margin-bottom: 10px; color: #333; }
  .columns { display: flex; gap: 20px; }
  .col { flex: 1; border: 1px solid #333; border-radius: 6px; padding: 10px; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px dashed #ccc; }
  .totals { margin-top: 12px; border-top: 2px solid #333; padding-top: 8px; }
  .totals .row { font-size: 15px; font-weight: 700; }
  .footer { margin-top: 14px; text-align: center; font-size: 11px; color: #555; }
</style>
</head>
<body>
  <h1>إيصال اشتراك كهرباء</h1>
  <div class="meta">التاريخ: ${fmtDate(now)}</div>
  <div class="columns">
    <div class="col">
      <div class="row"><span>الشهر:</span><b>${record.month}</b></div>
      <div class="row"><span>الاسم:</span><b>${subscriber.name} ${subscriber.familyName || ""}</b></div>
      <div class="row"><span>اسم الأب:</span><b>${subscriber.fatherName || ""}</b></div>
      <div class="row"><span>الهاتف:</span><b>${subscriber.phone || ""}</b></div>
      <div class="row"><span>رقم /اسم العلبة:</span><b>${subscriber.box || ""}</b></div>
      <div class="row"><span>قراءة سابقة:</span><b>${record.prev}</b></div>
      <div class="row"><span>قراءة حالية:</span><b>${record.curr}</b></div>
      <div class="row"><span>الاستهلاك (kWh):</span><b>${usedKwh}</b></div>
    </div>
    <div class="col">
      ${rightSection}
      ${discountRow}
      ${depositRow}
      <div class="row"><span>رصيد سابق:</span><b>${lastDebtLira} ل.ل</b></div>
    </div>
  </div>
  <div class="totals">
    <div class="row"><span>الإجمالي:</span><b>${printedTotalLira} ل.ل / $${printedTotalUsd.toFixed(2)}</b></div>
    <div class="row"><span>تم استلام مبلغ ل.ل:</span><b>${paidLira} ل.ل ($${record.paid.toFixed(2)})</b></div>
    <div class="row"><span>المتبقي:</span><b>${remainingLira} ل.ل ($${record.remaining.toFixed(2)})</b></div>
  </div>
  <div class="footer">طُبع في: ${fmtDate(now)}</div>
</body>
</html>
`;

  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
}
