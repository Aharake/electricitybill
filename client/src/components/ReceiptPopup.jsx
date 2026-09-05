import { useState } from "react";
import { api } from "../api";
import { useRate } from "../RateContext.jsx";
import { formatLira, parseLiraInput, usdToLira, liraToUsd } from "../format.js";
import { computeRecord } from "../calc.js";
import { openPrintWindow } from "./printReceipt.js";

const BILLING_LABEL = { METER: "عداد", FIXED: "ثابت", FREE: "مجاني" };

export default function ReceiptPopup({ record, subscriber, onClose, onSaved }) {
  const { rate } = useRate();
  const [month, setMonth] = useState(record.month);
  const [curr, setCurr] = useState(record.curr);
  const [priceLira, setPriceLira] = useState(formatLira(usdToLira(record.pricePerAmpUsd, rate)));
  const [discountLira, setDiscountLira] = useState(formatLira(usdToLira(record.discountUsd, rate)));
  const [paidLira, setPaidLira] = useState("0");
  const [paidUsdInput, setPaidUsdInput] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const liveRecord = {
    ...record,
    curr: Number(curr) || 0,
    pricePerAmpUsd: liraToUsd(parseLiraInput(priceLira), rate),
    discountUsd: liraToUsd(parseLiraInput(discountLira), rate),
    paidUsd: liraToUsd(parseLiraInput(paidLira), rate) + (Number(paidUsdInput) || 0),
  };
  const computed = computeRecord(subscriber, liveRecord);

  async function persist() {
    return api.monthlyBills.update(record.id, {
      month,
      curr: Number(curr) || 0,
      pricePerAmpLira: parseLiraInput(priceLira),
      discountLira: parseLiraInput(discountLira),
      paidLira: parseLiraInput(paidLira),
      paidUsdInput: Number(paidUsdInput) || 0,
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await persist();
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint() {
    setSaving(true);
    setError("");
    try {
      await persist();
      const printed = await api.monthlyBills.print(record.id);
      openPrintWindow(printed, subscriber);
      onSaved && onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const statusClass =
    computed.status === "مدفوع" ? "status-paid" : computed.status === "مدفوع جزئياً" ? "status-partial" : "status-unpaid";

  return (
    <div className="modal-overlay">
      <div className="modal-box receipt-box">
        <h2>نافذة الإيصال - {subscriber.name} {subscriber.familyName}</h2>
        {error && <div className="error-text">{error}</div>}
        <div className="receipt-grid">
          <div className="form-row">
            <label>المشترك</label>
            <input value={`${subscriber.name} ${subscriber.familyName || ""}`} disabled />
          </div>
          <div className="form-row">
            <label>اسم الأب</label>
            <input value={subscriber.fatherName || ""} disabled />
          </div>
          <div className="form-row">
            <label>شهر (yyyy-MM)</label>
            <input value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>

          <div className="form-row">
            <label>قراءة سابقة</label>
            <input value={record.prev} disabled />
          </div>
          <div className="form-row">
            <label>قراءة حالية</label>
            <input value={curr} onChange={(e) => setCurr(e.target.value.replace(/[^\d.]/g, ""))} disabled={subscriber.billingType !== "METER"} />
          </div>

          <div className="form-row">
            <label>الاستهلاك (محسوب)</label>
            <input value={computed.used} disabled />
          </div>
          <div className="form-row">
            <label>سعر الأمبير (ليرة)</label>
            <input value={priceLira} onChange={(e) => setPriceLira(e.target.value.replace(/[^\d]/g, ""))} disabled={subscriber.billingType !== "METER"} />
          </div>

          <div className="form-row">
            <label>رسم الاشتراك (ليرة)</label>
            <input value={formatLira(usdToLira(record.subscriptionFeeUsd, rate))} disabled />
          </div>
          <div className="form-row">
            <label>خصم (ليرة)</label>
            <input value={discountLira} onChange={(e) => setDiscountLira(e.target.value.replace(/[^\d]/g, ""))} />
          </div>

          <div className="form-row">
            <label>المبلغ (المحسوب)</label>
            <input value={formatLira(usdToLira(computed.value, rate))} disabled />
          </div>
          <div className="form-row">
            <label>دين سابق (ليرة)</label>
            <input value={formatLira(usdToLira(record.lastDebtUsd, rate))} disabled />
          </div>

          <div className="form-row">
            <label>الإجمالي (ليرة)</label>
            <input value={formatLira(usdToLira(computed.total, rate))} disabled />
          </div>
          <div className="form-row">
            <label>الإجمالي ($)</label>
            <input value={computed.total.toFixed(2)} disabled />
          </div>

          <div className="form-row">
            <label>المدفوع الآن (ليرة)</label>
            <input value={paidLira} onChange={(e) => setPaidLira(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
          <div className="form-row">
            <label>المدفوع الآن ($)</label>
            <input value={paidUsdInput} onChange={(e) => setPaidUsdInput(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>

          <div className="form-row">
            <label>المتبقي (ليرة)</label>
            <input value={formatLira(usdToLira(computed.remaining, rate))} disabled />
          </div>
          <div className="form-row">
            <label>المتبقي ($)</label>
            <input value={computed.remaining.toFixed(2)} disabled />
          </div>

          <div className="form-row">
            <label>الحالة</label>
            <input className={statusClass} value={computed.status} disabled />
          </div>
          <div className="form-row">
            <label>نوع الاشتراك</label>
            <input value={BILLING_LABEL[subscriber.billingType]} disabled />
          </div>
        </div>

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>إغلاق</button>
          <button className="btn btn-green" onClick={handlePrint} disabled={saving}>طباعة</button>
          <button className="btn" onClick={handleSave} disabled={saving}>حفظ</button>
        </div>
      </div>
    </div>
  );
}
