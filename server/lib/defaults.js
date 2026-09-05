export const DEFAULT_RATE = 89000;

// USD defaults per spec (screen 5 - أسعار الاشتراك)
export const DEFAULT_PRICING_USD = [
  { amps: 2.5, priceUsd: 5 },
  { amps: 5, priceUsd: 8 },
  { amps: 6, priceUsd: 10 },
  { amps: 10, priceUsd: 15 },
  { amps: 15, priceUsd: 20 },
  { amps: 20, priceUsd: 25 },
  { amps: 25, priceUsd: 30 },
  { amps: 30, priceUsd: 35 },
];

// USD defaults per spec (screen 6 - أسعار ثابت الخاصة)
export const DEFAULT_THABET_USD = [
  { amps: 2.5, priceUsd: 6 },
  { amps: 5, priceUsd: 10 },
  { amps: 6, priceUsd: 12 },
  { amps: 10, priceUsd: 18 },
  { amps: 15, priceUsd: 25 },
  { amps: 20, priceUsd: 30 },
  { amps: 25, priceUsd: 35 },
  { amps: 30, priceUsd: 40 },
];

export const BILLING_TYPES = {
  METER: "عداد",
  FIXED: "ثابت",
  FREE: "مجاني",
};

export function isThabetName(name) {
  if (!name) return false;
  const n = String(name);
  return n.includes("ثابت") || n.toLowerCase().includes("thabet");
}
