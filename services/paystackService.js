// services/paystackService.js
import Payment from "../models/FeePayment.js";
import { HttpError } from "../utils/studentContext.js";

/*
  Needs in backend/.env:
    PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx      (NEVER put this in the frontend)

  Uses the built-in fetch, so it needs Node 18 or newer (check: node -v).
*/

const PAYSTACK_URL = "https://api.paystack.co";

export const secretKey = () => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new HttpError(500, "Paystack is not configured on the server");
  return key;
};

export const paystack = async (path, options = {}) => {
  const res = await fetch(`${PAYSTACK_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();

  if (!res.ok || !json.status) {
    throw new HttpError(502, json.message || "Paystack request failed");
  }

  return json.data;
};

/*
  Marks a payment successful ONLY if Paystack says it succeeded and the
  amount and currency match what we asked for. Safe to call twice.
*/
export const settlePayment = async (payment, data) => {
  if (payment.status === "success") return payment;

  if (data.status === "failed") {
    payment.status = "failed";
    await payment.save();
    return payment;
  }

  if (data.status !== "success") return payment; // abandoned / still pending

  if (data.amount !== payment.amount * 100 || data.currency !== "NGN") {
    console.error("PAYMENT AMOUNT MISMATCH:", payment.reference, data.amount);
    payment.status = "failed";
    await payment.save();
    return payment;
  }

  payment.status = "success";
  payment.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
  payment.channel = data.channel;
  await payment.save();
  return payment;
};

/*
  A payment is saved as "pending" the moment the student clicks Pay, and only
  becomes "success" once Paystack confirms it. Normally the callback page or
  the webhook does that. This is the safety net: it asks Paystack about the
  student's recent pending payments, so a payment is never left showing as
  unpaid just because the callback page or webhook didn't run.
*/
export const reconcilePendingPayments = async (studentId) => {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48 hours

  const pending = await Payment.find({
    student: studentId,
    status: "pending",
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(5);

  for (const payment of pending) {
    try {
      const data = await paystack(
        `/transaction/verify/${encodeURIComponent(payment.reference)}`
      );
      await settlePayment(payment, data);
    } catch (error) {
      // e.g. the student never reached checkout: leave it pending
      console.error("RECONCILE SKIPPED:", payment.reference, error.message);
    }
  }
};