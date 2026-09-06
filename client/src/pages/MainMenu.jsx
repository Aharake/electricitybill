import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useRate } from "../RateContext.jsx";
import { useLoading } from "../LoadingContext.jsx";
import { formatLira, parseLiraInput } from "../format.js";
import { logout } from "../auth.js";

const CARDS = [
  { key: "subscribers", title: "المشتركين", subtitle: "إضافة، تعديل، وحذف المشتركين", color: "#3498db", path: "/subscribers" },
  { key: "bills", title: "فواتير شهرية", subtitle: "إدارة الفواتير والحسابات الشهرية", color: "#27ae60", path: "/monthly-bills" },
  { key: "pricing", title: "أسعار الاشتراك", subtitle: "تحديد أسعار الاشتراك للأمبير المختلفة", color: "#e67e22", path: "/pricing" },
  { key: "box", title: "رقم العلبة", subtitle: "تحديث قراءات المشتركين حسب رقم العلبة", color: "#9b59b6", path: "/box-readings" },
  { key: "stats", title: "الإحصائيات", subtitle: "عرض إحصائيات الفواتير والمدفوعات الشهرية", color: "#e74c3c", path: "/statistics" },
  { key: "thabet", title: "أسعار ثابت", subtitle: "أسعار خاصة للمشترك ثابت", color: "#16a085", path: "/thabet-pricing" },
];

export default function MainMenu() {
  const navigate = useNavigate();
  const { rate, setRate, loaded } = useRate();
  const { runWithLoading } = useLoading();

  useEffect(() => {
    document.title = "القائمة الرئيسية - نظام فواتير الاشتراك الكهربائي";
  }, []);

  function openCard(path) {
    runWithLoading(() => new Promise((resolve) => setTimeout(resolve, 300))).then(() => navigate(path));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>نظام فواتير الاشتراك الكهربائي</h1>
        <button className="btn btn-secondary" onClick={logout}>تسجيل الخروج</button>
      </header>
      <div className="page-body">
        <div className="page-title" style={{ textAlign: "center" }}>القائمة الرئيسية</div>

        <div className="exchange-rate-bar">
          <label>سعر الصرف (ليرة لكل دولار):</label>
          <input
            type="text"
            value={loaded ? formatLira(rate) : ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              setRate(Number(digits) || 0);
            }}
          />
        </div>

        <div className="card-grid">
          {CARDS.map((c) => (
            <button
              key={c.key}
              className="menu-card"
              style={{ background: c.color }}
              onClick={() => openCard(c.path)}
            >
              <div className="title">{c.title}</div>
              <div className="subtitle">{c.subtitle}</div>
            </button>
          ))}
        </div>

        <div className="footer-note">
          <div>اختر القسم المطلوب من القائمة أعلاه</div>
          <div>يمكنك التنقل بين الأقسام المختلفة لإدارة النظام</div>
        </div>
      </div>
    </div>
  );
}
