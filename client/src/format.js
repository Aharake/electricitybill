export function formatLira(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("en-US");
}

export function usdToLira(usd, rate) {
  return Math.round((Number(usd) || 0) * rate);
}

export function liraToUsd(lira, rate) {
  return (Number(lira) || 0) / rate;
}

export function parseLiraInput(str) {
  return Number(String(str).replace(/,/g, "")) || 0;
}
