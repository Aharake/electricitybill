import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useRate } from "../RateContext.jsx";
import { formatLira, usdToLira, parseLiraInput } from "../format.js";
import ReceiptPopup from "../components/ReceiptPopup.jsx";

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_OPTIONS = ["الكل", "مدفوع", "مدفوع جزئياً", "غير مدفوع"];

function fullName(sub) {
  return `${sub?.name || ""} ${sub?.familyName || ""}`.trim();
}

export default function MonthlyBills() {
  const navigate = useNavigate();
  const { rate } = useRate();
  const [searchParams] = useSearchParams();
  const subscriberId = searchParams.get("subscriberId");

  const [actionMonth, setActionMonth] = useState(todayMonth());
  const [viewMonth, setViewMonth] = useState(todayMonth());
  const [availableMonths, setAvailableMonths] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("الكل");
  const [priceLira, setPriceLira] = useState("");
  const [showFullMonth, setShowFullMonth] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [receiptRecord, setReceiptRecord] = useState(null);
  const [statementSubscriber, setStatementSubscriber] = useState(null);
  const [edits, setEdits] = useState({});

  useEffect(() => {
    document.title = subscriberId
      ? "كشف الحساب - نظام فواتير الاشتراك الكهربائي"
      : "الفواتير الشهرية - نظام فواتير الاشتراك الكهربائي";
  }, [subscriberId]);

  useEffect(() => {
    api.monthlyBills.months().then(setAvailableMonths);
  }, []);

  const loadRows = useCallback(() => {
    if (subscriberId) {
      api.subscribers.statement(subscriberId).then((res) => {
        setStatementSubscriber(res.subscriber);
        setRows(res.records.map((r) => ({ ...r, subscriber: res.subscriber })));
      });
    } else if (showFullMonth) {
      api.monthlyBills.list().then(setRows);
    } else {
      api.monthlyBills.list(viewMonth).then(setRows);
    }
  }, [subscriberId, viewMonth, showFullMonth]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (status !== "الكل") list = list.filter((r) => r.status === status);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.subscriber?.name, r.subscriber?.familyName, r.subscriber?.box, r.curr, r.prev]
          .map((v) => String(v ?? "").toLowerCase())
          .some((v) => v.includes(q))
      );
    }
    return list;
  }, [rows, status, search]);

  function fieldValue(row, field) {
    const key = `${row.id}:${field}`;
    return edits[key] !== undefined ? edits[key] : undefined;
  }

  function setFieldValue(row, field, value) {
    setEdits((e) => ({ ...e, [`${row.id}:${field}`]: value }));
  }

  async function commitField(row, field, payloadKey, transform = (v) => v) {
    const key = `${row.id}:${field}`;
    if (edits[key] === undefined) return;
    const value = transform(edits[key]);
    await api.monthlyBills.update(row.id, { [payloadKey]: value });
    setEdits((e) => {
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
    loadRows();
  }

  async function handleCreate() {
    await api.monthlyBills.create(actionMonth);
    setViewMonth(actionMonth);
    api.monthlyBills.months().then(setAvailableMonths);
    loadRows();
  }

  async function handleClose() {
    const r = await api.monthlyBills.close(actionMonth);
    setActionMonth(r.nextMonth);
    setViewMonth(r.nextMonth);
    api.monthlyBills.months().then(setAvailableMonths);
    loadRows();
  }

  async function handleUpdatePrice() {
    const r = await api.monthlyBills.updatePrice(viewMonth, parseLiraInput(priceLira));
    alert(r.message);
    loadRows();
  }

  async function handlePrint() {
    if (!selectedRowId) return alert("اختر فاتورة للطباعة.");
    const row = rows.find((r) => r.id === selectedRowId);
    setReceiptRecord(row);
  }

  async function handleBackToMenu() {
    await api.settings.save();
    navigate("/");
  }

  function handleAddMonth() {
    const value = prompt("أدخل الشهر الجديد بصيغة yyyy-MM", todayMonth());
    if (!value || !/^\d{4}-\d{2}$/.test(value)) return;
    setAvailableMonths((ms) => (ms.includes(value) ? ms : [...ms, value]));
    setActionMonth(value);
  }

  const title = subscriberId ? `كشف الحساب - ${fullName(statementSubscriber)}` : "الفواتير الشهرية";

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{title}</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleBackToMenu}>القائمة الرئيسية</button>
          <button className="btn" onClick={() => navigate("/subscribers")}>عودة للمشتركين</button>
        </div>
      </header>

      <div className="page-body">
        {!subscriberId && (
          <div className="toolbar">
            <label>شهر (yyyy-MM):</label>
            <select value={actionMonth} onChange={(e) => setActionMonth(e.target.value)}>
              {[...new Set([actionMonth, ...availableMonths])].sort().reverse().map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button className="btn btn-purple" onClick={handleAddMonth}>+ شهر جديد</button>
            <button className="btn" onClick={handleCreate}>إنشاء سجلات</button>
            <button className="btn btn-orange" onClick={handleClose}>إقفال الشهر ▶</button>

            <input placeholder="بحث (اسم/ص.علبة/قراءة...)" value={search} onChange={(e) => setSearch(e.target.value)} />

            <label>عرض شهر:</label>
            <select value={viewMonth} onChange={(e) => setViewMonth(e.target.value)}>
              {[...new Set([viewMonth, ...availableMonths])].sort().reverse().map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <label>حالة:</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <label>سعر الأمبير:</label>
            <input placeholder="0" value={priceLira} onChange={(e) => setPriceLira(e.target.value.replace(/[^\d]/g, ""))} style={{ width: 100 }} />
            <button className="btn" onClick={handleUpdatePrice}>تحديث السعر</button>

            <label>
              <input type="checkbox" checked={showFullMonth} onChange={(e) => setShowFullMonth(e.target.checked)} />
              {" "}إظهار الشهر الكامل
            </label>

            <button className="btn btn-purple" onClick={handlePrint}>طباعة إيصال</button>
          </div>
        )}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الشهر</th>
                <th>رقم العلبة</th>
                <th>الاسم</th>
                <th>السابقة</th>
                <th>اشتراك أمبير</th>
                <th>الحالي</th>
                <th>استهلاك</th>
                <th>سعر الأمبير (ليرة)</th>
                <th>خصم (ليرة)</th>
                <th>القيمة (ليرة)</th>
                <th>دين سابق (ليرة)</th>
                <th>الإجمالي (ليرة)</th>
                <th>الإجمالي ($)</th>
                <th>المدفوع (ليرة)</th>
                <th>المدفوع ($)</th>
                <th>المتبقي (ليرة)</th>
                <th>المتبقي ($)</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const statusClass = r.status === "مدفوع" ? "status-paid" : r.status === "مدفوع جزئياً" ? "status-partial" : "status-unpaid";
                return (
                  <tr
                    key={r.id}
                    className={r.id === selectedRowId ? "selected" : ""}
                    onClick={() => setSelectedRowId(r.id)}
                  >
                    <td>{r.month}</td>
                    <td>{r.subscriber?.box}</td>
                    <td>{fullName(r.subscriber)}</td>
                    <td>{r.prev}</td>
                    <td>{r.subscriber?.amps}</td>
                    <td>
                      <input
                        value={fieldValue(r, "curr") ?? r.curr}
                        onChange={(e) => setFieldValue(r, "curr", e.target.value.replace(/[^\d.]/g, ""))}
                        onBlur={() => commitField(r, "curr", "curr")}
                      />
                    </td>
                    <td>{r.used}</td>
                    <td>
                      <input
                        value={fieldValue(r, "price") ?? formatLira(usdToLira(r.pricePerAmpUsd, rate))}
                        onChange={(e) => setFieldValue(r, "price", e.target.value.replace(/[^\d]/g, ""))}
                        onBlur={() => commitField(r, "price", "pricePerAmpLira", parseLiraInput)}
                      />
                    </td>
                    <td>
                      <input
                        value={fieldValue(r, "discount") ?? formatLira(usdToLira(r.discountUsd, rate))}
                        onChange={(e) => setFieldValue(r, "discount", e.target.value.replace(/[^\d]/g, ""))}
                        onBlur={() => commitField(r, "discount", "discountLira", parseLiraInput)}
                      />
                    </td>
                    <td>{formatLira(usdToLira(r.value, rate))}</td>
                    <td>{formatLira(usdToLira(r.lastDebtUsd, rate))}</td>
                    <td>{formatLira(usdToLira(r.total, rate))}</td>
                    <td>{r.total.toFixed(2)}</td>
                    <td>
                      <input
                        value={fieldValue(r, "paid") ?? formatLira(usdToLira(r.paidUsd, rate))}
                        onChange={(e) => setFieldValue(r, "paid", e.target.value.replace(/[^\d]/g, ""))}
                        onBlur={() => commitField(r, "paid", "paidLira", parseLiraInput)}
                      />
                    </td>
                    <td>{r.paid.toFixed(2)}</td>
                    <td>{formatLira(usdToLira(r.remaining, rate))}</td>
                    <td>{r.remaining.toFixed(2)}</td>
                    <td className={statusClass}>{r.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {receiptRecord && (
        <ReceiptPopup
          record={receiptRecord}
          subscriber={receiptRecord.subscriber}
          onClose={() => setReceiptRecord(null)}
          onSaved={loadRows}
        />
      )}
    </div>
  );
}
