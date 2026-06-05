// To'lov provayderlari konfiguratsiyasi (.env dan)
// Bularsiz checkout ishlamaydi — merchant shartnoma olgach to'ldiring.

export const APP_URL = process.env.APP_URL || "http://localhost:3000";

export const PAYME = {
  // Payme Business → kassa sozlamalaridan olinadi
  merchantId: process.env.PAYME_MERCHANT_ID || "",
  // Merchant API kaliti (test va prod uchun alohida)
  key: process.env.PAYME_KEY || "",
  // Checkout sahifa (prod: checkout.paycom.uz, test: checkout.test.paycom.uz)
  checkoutBase:
    process.env.PAYME_CHECKOUT_URL || "https://checkout.paycom.uz",
};

export const CLICK = {
  serviceId: process.env.CLICK_SERVICE_ID || "",
  merchantId: process.env.CLICK_MERCHANT_ID || "",
  // SHOP API maxfiy kaliti (imzo tekshirish uchun)
  secretKey: process.env.CLICK_SECRET_KEY || "",
  // Click checkout sahifasi
  checkoutBase:
    process.env.CLICK_CHECKOUT_URL || "https://my.click.uz/services/pay",
};

export function paymeConfigured(): boolean {
  return Boolean(PAYME.merchantId && PAYME.key);
}

export function clickConfigured(): boolean {
  return Boolean(CLICK.serviceId && CLICK.merchantId && CLICK.secretKey);
}
