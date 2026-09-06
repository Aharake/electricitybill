import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { setToken } from "../auth.js";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "تسجيل الدخول - نظام فواتير الاشتراك الكهربائي";
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await api.auth.login(username, password);
      setToken(token);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
      <form className="modal-box dialog-box" onSubmit={handleSubmit}>
        <h2 style={{ textAlign: "center" }}>تسجيل الدخول</h2>
        <div style={{ textAlign: "center", color: "#7f8c8d", fontSize: 13, marginBottom: 14 }}>
          نظام فواتير الاشتراك الكهربائي
        </div>
        {error && <div className="error-text" style={{ textAlign: "center", marginBottom: 8 }}>{error}</div>}
        <div className="form-row">
          <label>اسم المستخدم</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="form-row">
          <label>كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="dialog-actions" style={{ justifyContent: "center" }}>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "..." : "دخول"}
          </button>
        </div>
      </form>
    </div>
  );
}
