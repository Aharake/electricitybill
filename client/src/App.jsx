import { Routes, Route } from "react-router-dom";
import MainMenu from "./pages/MainMenu.jsx";
import Subscribers from "./pages/Subscribers.jsx";
import MonthlyBills from "./pages/MonthlyBills.jsx";
import BoxReadings from "./pages/BoxReadings.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import Statistics from "./pages/Statistics.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/subscribers" element={<Subscribers />} />
      <Route path="/monthly-bills" element={<MonthlyBills />} />
      <Route path="/box-readings" element={<BoxReadings />} />
      <Route path="/pricing" element={<PricingPage scope="regular" />} />
      <Route path="/thabet-pricing" element={<PricingPage scope="thabet" />} />
      <Route path="/statistics" element={<Statistics />} />
    </Routes>
  );
}
