import { Routes, Route, Navigate } from "react-router-dom";
import MainMenu from "./pages/MainMenu.jsx";
import Subscribers from "./pages/Subscribers.jsx";
import MonthlyBills from "./pages/MonthlyBills.jsx";
import BoxReadings from "./pages/BoxReadings.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import Statistics from "./pages/Statistics.jsx";
import Login from "./pages/Login.jsx";
import { getToken } from "./auth.js";

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><MainMenu /></RequireAuth>} />
      <Route path="/subscribers" element={<RequireAuth><Subscribers /></RequireAuth>} />
      <Route path="/monthly-bills" element={<RequireAuth><MonthlyBills /></RequireAuth>} />
      <Route path="/box-readings" element={<RequireAuth><BoxReadings /></RequireAuth>} />
      <Route path="/pricing" element={<RequireAuth><PricingPage scope="regular" /></RequireAuth>} />
      <Route path="/thabet-pricing" element={<RequireAuth><PricingPage scope="thabet" /></RequireAuth>} />
      <Route path="/statistics" element={<RequireAuth><Statistics /></RequireAuth>} />
    </Routes>
  );
}
