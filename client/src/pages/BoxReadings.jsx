import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

export default function BoxReadings() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(todayMonth());
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState({});

  useEffect(() => {
    document.title = "تحديث قراءات رقم العلبة";
  }, []);

  const monthValid = MONTH_RE.test(month);

  function loadRows() {
    if (!monthValid) return;
    api.boxReadings.list(month).then(setRows);
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.name, r.familyName, r.box].map((v) => String(v ?? "").toLowerCase()).some((v) => v.includes(q)));
  }, [rows, search]);

  async function handleCreateUpdate() {
    try {
      const r = await api.boxReadings.upsert(month);
      alert(r.message);
      loadRows();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleSaveExcel() {
    const r = await api.settings.save();
    alert(r.message);
  }

  function fieldValue(row) {
    return edits[row.id] !== undefined ? edits[row.id] : row.curr;
  }

  async function commit(row) {
    if (edits[row.id] === undefined) return;
    await api.boxReadings.update(row.id, Number(edits[row.id]) || 0);
    setEdits((e) => {
      const copy = { ...e };
      delete copy[row.id];
      return copy;
    });
    loadRows();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>تحديث قراءات رقم العلبة</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate("/")}>القائمة الرئيسية</button>
        </div>
      </header>

      <div className="page-body">
        <div className="toolbar">
          <label>الشهر:</label>
          <input value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 100 }} />
          <button className="btn" onClick={handleCreateUpdate} disabled={!monthValid}>إنشاء/تحديث السجلات</button>
          <button className="btn btn-green" onClick={handleSaveExcel} disabled={!monthValid}>حفظ إلى Excel</button>
          <input placeholder="ابحث بالاسم أو رقم العلبة" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-secondary" onClick={() => setSearch("")}>مسح</button>
        </div>

        {!monthValid && <div className="error-text">يرجى إدخال شهر بصيغة yyyy-MM</div>}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم العلبة</th>
                <th>الاسم</th>
                <th>اسم العائلة</th>
                <th>اسم الأب</th>
                <th>القراءة السابقة</th>
                <th>القراءة الحالية</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.box}</td>
                  <td>{r.name}</td>
                  <td>{r.familyName}</td>
                  <td>{r.fatherName}</td>
                  <td>{r.prev}</td>
                  <td>
                    <input
                      value={fieldValue(r)}
                      onChange={(e) => setEdits((ed) => ({ ...ed, [r.id]: e.target.value.replace(/[^\d]/g, "") }))}
                      onBlur={() => commit(r)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
