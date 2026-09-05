import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useRate } from "../RateContext.jsx";
import { formatLira, usdToLira, parseLiraInput } from "../format.js";
import ReceiptPopup from "../components/ReceiptPopup.jsx";

const BILLING_LABEL = { METER: "عداد", FIXED: "ثابت", FREE: "مجاني" };

function fullName(sub) {
  return `${sub?.name || ""} ${sub?.familyName || ""}`.trim();
}

function emptyForm() {
  return { name: "", familyName: "", fatherName: "", phone: "", box: "", amps: "", securityDepositLira: "0", billingType: "METER" };
}

export default function Subscribers() {
  const navigate = useNavigate();
  const { rate } = useRate();
  const [subscribers, setSubscribers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [dialog, setDialog] = useState(null); // 'add' | 'edit' | null
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [payDialogFor, setPayDialogFor] = useState(null);
  const [payMonths, setPayMonths] = useState([]);
  const [payMonth, setPayMonth] = useState("");
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => {
    document.title = "إدارة المشتركين - نظام فواتير الاشتراك الكهربائي";
    load();
  }, []);

  function load() {
    api.subscribers.list().then(setSubscribers);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter((s) =>
      [s.id, s.name, s.familyName, s.fatherName, s.phone, s.box, s.amps, usdToLira(s.securityDepositUsd, rate), BILLING_LABEL[s.billingType]]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [subscribers, search, rate]);

  function openAdd() {
    setForm(emptyForm());
    setFormError("");
    setDialog("add");
  }

  function openEdit(sub) {
    setForm({
      name: sub.name,
      familyName: sub.familyName,
      fatherName: sub.fatherName,
      phone: sub.phone,
      box: sub.box,
      amps: String(sub.amps),
      securityDepositLira: formatLira(usdToLira(sub.securityDepositUsd, rate)),
      billingType: sub.billingType,
      _id: sub.id,
    });
    setFormError("");
    setDialog("edit");
  }

  async function submitForm() {
    const payload = {
      name: form.name.trim(),
      familyName: form.familyName.trim(),
      fatherName: form.fatherName.trim(),
      phone: form.phone.trim(),
      box: form.box,
      amps: form.amps,
      securityDepositLira: parseLiraInput(form.securityDepositLira),
      billingType: form.billingType,
    };
    try {
      if (dialog === "add") {
        const r = await api.subscribers.create(payload);
        alert(r.message);
      } else {
        const r = await api.subscribers.update(form._id, payload);
        alert(r.message);
      }
      setDialog(null);
      load();
    } catch (e) {
      setFormError(e.message);
    }
  }

  async function handleDelete() {
    if (!selectedId) return alert("يرجى اختيار مشترك للحذف");
    if (!confirm("حذف المشترك وجميع سجلاته؟")) return;
    await api.subscribers.remove(selectedId);
    setSelectedId(null);
    load();
  }

  function handleStatement(id) {
    if (!id) return alert("يرجى اختيار مشترك لعرض الكشف");
    navigate(`/monthly-bills?subscriberId=${id}`);
  }

  async function openPayDialog(id) {
    const sub = subscribers.find((s) => s.id === id);
    const months = await api.subscribers.payMonths(id);
    setPayMonths(months);
    setPayMonth(months[months.length - 1] || "");
    setPayDialogFor(sub);
  }

  async function openReceiptFromPay() {
    const { record, subscriber } = await api.subscribers.pay(payDialogFor.id, payMonth);
    setPayDialogFor(null);
    setReceiptData({ record, subscriber });
  }

  async function handleSaveExcel() {
    const r = await api.settings.save();
    alert(r.message);
  }

  async function handleLoadExcel() {
    await api.settings.load();
    load();
  }

  async function handleCounts() {
    const counts = await api.subscribers.counts();
    alert(counts.map((c) => `${c.id} - ${c.name} : ${c.monthlyRowCount}`).join("\n"));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>إدارة المشتركين</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate("/")}>← العودة للقائمة الرئيسية</button>
          <button className="btn" onClick={handleLoadExcel}>تحميل البيانات</button>
          <button className="btn btn-green" onClick={handleSaveExcel}>حفظ البيانات</button>
          <button className="btn btn-purple" onClick={handleCounts}>عدد السجلات</button>
        </div>
      </header>

      <div className="page-body">
        <div className="stats-cards">
          <div className="stat-card">
            <div className="label">إجمالي المشتركين</div>
            <div className="value">{filtered.length}</div>
          </div>
        </div>

        <div className="toolbar">
          <input placeholder="ابحث عن مشترك..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240 }} />
          <button className="btn" onClick={openAdd}>إضافة مشترك جديد</button>
          <button className="btn btn-orange" onClick={() => { const s = subscribers.find((x) => x.id === selectedId); s ? openEdit(s) : alert("يرجى اختيار مشترك"); }}>تعديل المحدد</button>
          <button className="btn btn-red" onClick={handleDelete}>حذف المحدد</button>
          <button className="btn btn-teal" onClick={() => handleStatement(selectedId)}>كَشَفَ الحِسَابَ</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>المعرّف</th>
                <th>الاسم</th>
                <th>اسم العائلة</th>
                <th>اسم الأب</th>
                <th>الهاتف</th>
                <th>رقم العلبة</th>
                <th>اشتراك الأمبير</th>
                <th>تأمين (ليرة)</th>
                <th>النوع</th>
                <th>كشف</th>
                <th>دفع</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className={s.id === selectedId ? "selected" : ""}
                  onClick={() => setSelectedId(s.id)}
                  onDoubleClick={() => openEdit(s)}
                >
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.familyName}</td>
                  <td>{s.fatherName}</td>
                  <td>{s.phone}</td>
                  <td>{s.box}</td>
                  <td>{s.amps}</td>
                  <td>{formatLira(usdToLira(s.securityDepositUsd, rate))}</td>
                  <td>{BILLING_LABEL[s.billingType]}</td>
                  <td><button className="btn btn-teal" onClick={(e) => { e.stopPropagation(); handleStatement(s.id); }}>كشف</button></td>
                  <td><button className="btn" onClick={(e) => { e.stopPropagation(); openPayDialog(s.id); }}>دفع</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <div className="modal-overlay">
          <div className="modal-box dialog-box" style={{ width: 400, height: 400, overflow: "auto" }}>
            <h2>{dialog === "add" ? "إضافة مشترك جديد" : "تعديل المشترك"}</h2>
            {formError && <div className="error-text">{formError}</div>}
            <div className="form-row">
              <label>الاسم الأول</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>اسم العائلة</label>
              <input value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} />
            </div>
            <div className="form-row">
              <label>اسم الأب</label>
              <input value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} />
            </div>
            <div className="form-row">
              <label>الهاتف</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-row">
              <label>رقم /اسم العلبة</label>
              <input value={form.box} onChange={(e) => setForm({ ...form, box: e.target.value })} />
            </div>
            <div className="form-row">
              <label>اشتراك الأمبير</label>
              <input value={form.amps} onChange={(e) => setForm({ ...form, amps: e.target.value })} />
            </div>
            <div className="form-row">
              <label>تأمين (ليرة)</label>
              <input value={form.securityDepositLira} onChange={(e) => setForm({ ...form, securityDepositLira: e.target.value.replace(/[^\d-]/g, "") })} />
            </div>
            <div className="form-row">
              <label>نوع الفاتورة</label>
              <select value={form.billingType} onChange={(e) => setForm({ ...form, billingType: e.target.value })}>
                <option value="METER">عداد</option>
                <option value="FIXED">ثابت</option>
                <option value="FREE">مجاني</option>
              </select>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setDialog(null)}>إلغاء</button>
              <button className="btn" onClick={submitForm}>حفظ</button>
            </div>
          </div>
        </div>
      )}

      {payDialogFor && (
        <div className="modal-overlay">
          <div className="modal-box dialog-box">
            <h2>دفع - {fullName(payDialogFor)}</h2>
            <div className="form-row">
              <label>الشهر</label>
              <select value={payMonth} onChange={(e) => setPayMonth(e.target.value)}>
                {payMonths.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setPayDialogFor(null)}>إلغاء</button>
              <button className="btn" onClick={openReceiptFromPay}>فتح الإيصال</button>
            </div>
          </div>
        </div>
      )}

      {receiptData && (
        <ReceiptPopup
          record={receiptData.record}
          subscriber={receiptData.subscriber}
          onClose={() => setReceiptData(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
