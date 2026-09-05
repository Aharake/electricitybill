import express from "express";
import cors from "cors";
import subscribersRouter from "./routes/subscribers.js";
import monthlyBillsRouter from "./routes/monthlyBills.js";
import boxReadingsRouter from "./routes/boxReadings.js";
import pricingRouter from "./routes/pricing.js";
import statisticsRouter from "./routes/statistics.js";
import settingsRouter from "./routes/settings.js";
import adminRouter from "./routes/admin.js";

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : true; // reflect any origin (fine for local dev; set CORS_ORIGIN in production)
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/subscribers", subscribersRouter);
app.use("/api/monthly-bills", monthlyBillsRouter);
app.use("/api/box-readings", boxReadingsRouter);
app.use("/api/pricing", pricingRouter);
app.use("/api/statistics", statisticsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/admin", adminRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Electric billing server running on http://localhost:${PORT}`);
});
