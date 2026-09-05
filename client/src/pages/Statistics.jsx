import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { formatLira } from "../format.js";

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Statistics() {
  const navigate = useNavigate();
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    document.title = "الإحصائيات الشهرية";
  }, []);

  const loadMonths = useCallback(() => {
    api.statistics.months().then((ms) => {
      setMonths(ms);
      if (!month && ms.length) setMonth(ms.includes(todayMonth()) ? todayMonth() : ms[0]);
    });
  }, [month]);

  useEffect(() => {
    loadMonths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = useCallback(() => {
    if (!month) return;
    api.statistics.get(month).then(setStats);
  }, [month]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleRefresh() {
    await api.settings.load();
    loadMonths();
    loadStats();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>الإحصائيات الشهرية</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate("/")}>← العودة للقائمة الرئيسية</button>
        </div>
      </header>

      <div className="page-body">
        <div className="toolbar">
          <label>اختر الشهر:</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">اختر شهراً</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn" onClick={handleRefresh}>تحديث</button>
        </div>

        {stats && (
          <div className="stats-cards">
            <div className="stat-card"><div className="label">إجمالي المشتركين</div><div className="value">{stats.totalSubscribers}</div></div>
            <div className="stat-card"><div className="label">إجمالي الإيرادات (ليرة)</div><div className="value">{formatLira(stats.totalRevenueLira)} ليرة</div></div>
            <div className="stat-card"><div className="label">المحصّل (ليرة)</div><div className="value">{formatLira(stats.collectedLira)} ليرة</div></div>
            <div className="stat-card"><div className="label">المتبقي (ليرة)</div><div className="value">{formatLira(stats.remainingLira)} ليرة</div></div>
            <div className="stat-card"><div className="label">مدفوع بالكامل</div><div className="value">{stats.fullyPaid}</div></div>
            <div className="stat-card"><div className="label">مدفوع جزئياً</div><div className="value">{stats.partiallyPaid}</div></div>
            <div className="stat-card"><div className="label">غير مدفوع</div><div className="value">{stats.unpaid}</div></div>
            <div className="stat-card"><div className="label">نسبة التحصيل</div><div className="value">{stats.collectionRate.toFixed(2)}%</div></div>
            <div className="stat-card"><div className="label">إجمالي الاستهلاك (أمبير)</div><div className="value">{stats.totalUsedAmps.toFixed(2)}</div></div>
            <div className="stat-card"><div className="label">متوسط الاستهلاك (أمبير)</div><div className="value">{stats.avgUsedAmps.toFixed(2)}</div></div>
            <div className="stat-card"><div className="label">أعلى استهلاك (أمبير)</div><div className="value">{stats.maxUsedAmps.toFixed(2)}</div></div>
            <div className="stat-card"><div className="label">إجمالي الخصم (ليرة)</div><div className="value">{formatLira(stats.totalDiscountLira)} ليرة</div></div>
            <div className="stat-card"><div className="label">إجمالي الديون السابقة (ليرة)</div><div className="value">{formatLira(stats.totalLastDebtLira)} ليرة</div></div>
            <div className="stat-card"><div className="label">متوسط الفاتورة (ليرة)</div><div className="value">{formatLira(stats.avgBillLira)} ليرة</div></div>
          </div>
        )}
        {!stats && <div className="footer-note">اختر شهراً لعرض الإحصائيات</div>}
      </div>
    </div>
  );
}
