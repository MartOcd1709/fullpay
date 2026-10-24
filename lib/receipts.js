// The receipt number both sides note in their books for a confirmed payment (from the payment's id, e.g. RCPT-000123).
export const receiptNo = (paymentId) => `RCPT-${String(paymentId).padStart(6, "0")}`;
