import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { formatLira, parseLiraInput } from "../format.js";

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PricingPage({ scope }) {
  const navigate = useNavigate();
  const isThabet = scope === "thabet";
  const [month, setMonth] = useState("");
  const [months, setMonths] = useState([]);
  const [rows, setRows] = useState([]);
  const [newAmps, setNewAmps] = useState(null);

  const title = isThabet ? "أسعار ثابت الخاصة" : "أسعار الاشتراك";
  const columnLabel = isThabet ? "السعر (ليرة)" : "السعر الشهري (ليرة)";

  useEffect(() => {
    document.title = `${title} - نظام فواتير الاشتراك الكهربائي`;
  }, [title]);

  function loadMonths() {
    api.pricing.months(scope).then(setMonths);
  }

  useEffect(() => {
    loadMonths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadRows() {
    api.pricing.list(scope, month || undefined).then((data) =>
      setRows(data.map((r) => ({ amps: r.amps, priceLiraStr: formatLira(r.priceLira) })))
    );
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function handleAddMonth() {
    const value = prompt("أدخل الشهر الجديد بصيغة yyyy-MM", todayMonth());
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return;
    setMonths((ms) => (ms.includes(value) ? ms : [...ms, value].sort().reverse()));
    setMonth(value);
  }

  const summary = useMemo(() => {
    const prices = rows.map((r) => parseLiraInput(r.priceLiraStr));
    if (!prices.length) return { count: 0, min: 0, max: 0, avg: 0 };
    return {
      count: prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    };
  }, [rows]);

  function setPrice(amps, value) {
    setRows((rs) => rs.map((r) => (r.amps === amps ? { ...r, priceLiraStr: value } : r)));
  }

  async function handleSave() {
    const payload = rows.map((r) => ({ amps: r.amps, priceLira: parseLiraInput(r.priceLiraStr) }));
    await api.pricing.save(scope, month || undefined, payload);
    alert("تم حفظ الأسعار");
    loadRows();
    loadMonths();
  }

  async function handleAdd() {
    const value = prompt("أدخل مستوى الأمبير الجديد");
    if (!value) return;
    const amps = Number(value);
    if (Number.isNaN(amps)) return;
    try {
      await api.pricing.add(scope, amps);
      loadRows();
    } catch (e) {
      alert("هذا المستوى موجود بالفعل");
    }
  }

  async function handleDelete() {
    if (newAmps == null) return alert("يرجى اختيار صف للحذف");
    await api.pricing.remove(scope, newAmps);
    setNewAmps(null);
    loadRows();
  }

  async function handleReset() {
    await api.pricing.reset(scope);
    loadRows();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{title}</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate("/")}>← العودة للقائمة الرئيسية</button>
        </div>
      </header>

      <div className="page-body">
        {isThabet && <div className="footer-note">الأسعار هنا خاصة بالمشترك المسمى "ثابت" فقط</div>}
        <div className="toolbar">
          <label>شهر (yyyy-MM)</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">السعر العام (كل الأشهر)</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button className="btn btn-purple" onClick={handleAddMonth}>+ شهر جديد</button>
          <button className="btn" onClick={handleSave}>حفظ الأسعار</button>
          <button className="btn btn-green" onClick={handleAdd}>إضافة سعر جديد</button>
          <button className="btn btn-red" onClick={handleDelete}>حذف المحدد</button>
          <button className="btn btn-secondary" onClick={handleReset}>إعادة تعيين للافتراضي</button>
        </div>

        <div className="footer-note">الأسعار بالليرة اللبنانية (LBP)</div>

        <table className="data-table" style={{ maxWidth: 500 }}>
          <thead>
            <tr>
              <th>مستوى الأمبير</th>
              <th>{isThabet ? "السعر (ليرة)" : columnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.amps} className={r.amps === newAmps ? "selected" : ""} onClick={() => setNewAmps(r.amps)}>
                <td>{r.amps}</td>
                <td>
                  <input
                    value={r.priceLiraStr}
                    onChange={(e) => setPrice(r.amps, e.target.value.replace(/[^\d]/g, ""))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="stats-cards" style={{ marginTop: 18 }}>
          <div className="stat-card"><div className="label">إجمالي مستويات</div><div className="value">{summary.count}</div></div>
          <div className="stat-card"><div className="label">أقل سعر</div><div className="value">{formatLira(summary.min)}</div></div>
          <div className="stat-card"><div className="label">أعلى سعر</div><div className="value">{formatLira(summary.max)}</div></div>
          <div className="stat-card"><div className="label">متوسط السعر</div><div className="value">{formatLira(summary.avg)}</div></div>
        </div>
      </div>
    </div>
  );
}
