// In local dev (npm run dev) this stays "/api" and Vite proxies it to localhost:4000.
// In production (Vercel), set VITE_API_URL to the deployed backend's full URL, e.g.
// https://your-app.up.railway.app/api — Vercel has no server to proxy through.
const BASE = import.meta.env.VITE_API_URL || "/api";

import { getToken, logout } from "./auth.js";

async function req(method, url, body) {
  const token = getToken();
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !url.startsWith("/auth/")) {
    // Never reload from here if we're already on the login page — that's
    // exactly the loop that turned into a runaway-request bug once before.
    if (!window.location.hash.startsWith("#/login")) logout();
    throw new Error("انتهت الجلسة، يرجى تسجيل الدخول من جديد");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "حدث خطأ");
  }
  return data;
}

export const api = {
  auth: {
    login: (username, password) => req("POST", "/auth/login", { username, password }),
    me: () => req("GET", "/auth/me"),
  },
  settings: {
    get: () => req("GET", "/settings"),
    update: (exchangeRate) => req("PUT", "/settings", { exchangeRate }),
    save: () => req("POST", "/settings/save"),
    load: () => req("POST", "/settings/load"),
  },
  subscribers: {
    list: () => req("GET", "/subscribers"),
    counts: () => req("GET", "/subscribers/counts"),
    create: (payload) => req("POST", "/subscribers", payload),
    update: (id, payload) => req("PUT", `/subscribers/${id}`, payload),
    remove: (id) => req("DELETE", `/subscribers/${id}`),
    statement: (id) => req("GET", `/subscribers/${id}/statement`),
    payMonths: (id) => req("GET", `/subscribers/${id}/pay-months`),
    pay: (id, month) => req("POST", `/subscribers/${id}/pay`, { month }),
  },
  monthlyBills: {
    list: (month) => req("GET", `/monthly-bills${month ? `?month=${month}` : ""}`),
    months: () => req("GET", "/monthly-bills/months"),
    update: (id, payload) => req("PUT", `/monthly-bills/${id}`, payload),
    create: (month) => req("POST", "/monthly-bills/create", { month }),
    close: (month) => req("POST", "/monthly-bills/close", { month }),
    updatePrice: (month, priceLira) => req("POST", "/monthly-bills/update-price", { month, priceLira }),
    print: (id) => req("POST", `/monthly-bills/${id}/print`),
  },
  boxReadings: {
    list: (month) => req("GET", `/box-readings?month=${month}`),
    upsert: (month) => req("POST", "/box-readings/upsert", { month }),
    update: (id, curr) => req("PUT", `/box-readings/${id}`, { curr }),
  },
  pricing: {
    months: (scope) => req("GET", `/pricing/${scope}/months`),
    list: (scope, month) => req("GET", `/pricing/${scope}${month ? `?month=${month}` : ""}`),
    save: (scope, month, rows) => req("PUT", `/pricing/${scope}`, { month, rows }),
    add: (scope, amps) => req("POST", `/pricing/${scope}/add`, { amps }),
    remove: (scope, amps) => req("DELETE", `/pricing/${scope}/${amps}`),
    reset: (scope) => req("POST", `/pricing/${scope}/reset`),
  },
  statistics: {
    months: () => req("GET", "/statistics/months"),
    get: (month) => req("GET", `/statistics?month=${month}`),
  },
};
