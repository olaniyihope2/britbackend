// // controller/paymentController.js
// import crypto from "crypto";
// import Payment from "../models/Payment.js";
// import {
//   HttpError,
//   getStudent,
//   getSession,
//   sendError,
// } from "../utils/studentContext.js";
// import { getFeeStatus } from "../services/feeService.js";

// /*
//   Needs in backend/.env:
//     PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx      (NEVER put this in the frontend)
//     FRONTEND_URL=http://localhost:8081

//   Uses the built-in fetch, so it needs Node 18 or newer (check: node -v).
// */

// const PAYSTACK_URL = "https://api.paystack.co";

// const secretKey = () => {
//   const key = process.env.PAYSTACK_SECRET_KEY;
//   if (!key) throw new HttpError(500, "Paystack is not configured on the server");
//   return key;
// };

// const paystack = async (path, options = {}) => {
//   const res = await fetch(`${PAYSTACK_URL}${path}`, {
//     ...options,
//     headers: {
//       Authorization: `Bearer ${secretKey()}`,
//       "Content-Type": "application/json",
//     },
//   });

//   const json = await res.json();

//   if (!res.ok || !json.status) {
//     throw new HttpError(502, json.message || "Paystack request failed");
//   }

//   return json.data;
// };

// /*
//   Marks a payment successful ONLY if Paystack says it succeeded and the
//   amount and currency match what we asked for. Safe to call twice.
// */
// const settlePayment = async (payment, data) => {
//   if (payment.status === "success") return payment;

//   if (data.status === "failed") {
//     payment.status = "failed";
//     await payment.save();
//     return payment;
//   }

//   if (data.status !== "success") return payment; // abandoned / still pending

//   if (data.amount !== payment.amount * 100 || data.currency !== "NGN") {
//     console.error("PAYMENT AMOUNT MISMATCH:", payment.reference, data.amount);
//     payment.status = "failed";
//     await payment.save();
//     return payment;
//   }

//   payment.status = "success";
//   payment.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
//   payment.channel = data.channel;
//   await payment.save();
//   return payment;
// };

// /* =====================================================
//    WHAT DOES THE STUDENT OWE?
//    GET /api/payments/status
// ===================================================== */

// export const getPaymentStatus = async (req, res) => {
//   try {
//     const { student } = await getStudent(req);
//     const session = await getSession(student);
//     const fees = await getFeeStatus(student, session);

//     res.status(200).json({
//       success: true,
//       session: session.name,
//       semester: session.semester,
//       ...fees,
//     });
//   } catch (error) {
//     sendError(res, error);
//   }
// };

// /* =====================================================
//    START A PAYMENT
//    POST /api/payments/initialize
//    body: { feeCode: "TUITION", amount: 40000 }   (amount only for tuition)
// ===================================================== */

// export const initializePayment = async (req, res) => {
//   try {
//     const { feeCode, amount } = req.body;

//     const { student } = await getStudent(req);

//     if (!student.email) {
//       throw new HttpError(400, "Add an email address to your profile first");
//     }

//     const session = await getSession(student);
//     const fees = await getFeeStatus(student, session);

//     const item = fees.items.find((i) => i.code === feeCode);

//     if (!item) {
//       throw new HttpError(404, "This fee does not apply to you");
//     }

//     if (item.balance <= 0) {
//       throw new HttpError(400, `${item.title} is already fully paid`);
//     }

//     // The server decides the amount. Only tuition may be part-paid.
//     let payAmount = item.balance;

//     if (item.partPayment) {
//       payAmount = Number(amount);

//       if (
//         !Number.isInteger(payAmount) ||
//         payAmount < 1 ||
//         payAmount > item.balance
//       ) {
//         throw new HttpError(
//           400,
//           `Enter an amount between 1 and ${item.balance.toLocaleString()}`
//         );
//       }
//     }

//     const reference = `BRIT-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

//     await Payment.create({
//       student: student._id,
//       feeCode: item.code,
//       title: item.title,
//       session: session.name,
//       semester: session.semester,
//       amount: payAmount,
//       reference,
//     });

//     const data = await paystack("/transaction/initialize", {
//       method: "POST",
//       body: JSON.stringify({
//         email: student.email,
//         amount: payAmount * 100, // Naira -> kobo
//         currency: "NGN",
//         reference,
//         callback_url: `${process.env.FRONTEND_URL}/student/dashboard/payment/callback`,
//         metadata: {
//           studentId: String(student._id),
//           feeCode: item.code,
//         },
//       }),
//     });

//     res.status(200).json({
//       success: true,
//       authorizationUrl: data.authorization_url,
//       reference,
//     });
//   } catch (error) {
//     sendError(res, error);
//   }
// };

// /* =====================================================
//    CHECK A PAYMENT AFTER PAYSTACK REDIRECTS BACK
//    GET /api/payments/verify/:reference
// ===================================================== */

// export const verifyPayment = async (req, res) => {
//   try {
//     const { reference } = req.params;

//     const payment = await Payment.findOne({
//       reference,
//       student: req.user.id, // a student can only check their own payments
//     });

//     if (!payment) {
//       throw new HttpError(404, "Payment not found");
//     }

//     if (payment.status !== "success") {
//       const data = await paystack(
//         `/transaction/verify/${encodeURIComponent(reference)}`
//       );
//       await settlePayment(payment, data);
//     }

//     res.status(200).json({
//       success: true,
//       status: payment.status,
//       title: payment.title,
//       feeCode: payment.feeCode,
//       amount: payment.amount,
//     });
//   } catch (error) {
//     sendError(res, error);
//   }
// };

// /* =====================================================
//    PAYSTACK WEBHOOK (backup in case the student closes the tab)
//    POST /api/payments/webhook
//    Must be mounted with express.raw() BEFORE express.json() in server.js
// ===================================================== */

// export const paystackWebhook = async (req, res) => {
//   try {
//     const signature = req.headers["x-paystack-signature"];

//     const hash = crypto
//       .createHmac("sha512", secretKey())
//       .update(req.body) // raw Buffer
//       .digest("hex");

//     if (hash !== signature) {
//       return res.sendStatus(401);
//     }

//     const event = JSON.parse(req.body.toString());

//     if (event.event === "charge.success") {
//       const payment = await Payment.findOne({ reference: event.data.reference });
//       if (payment) await settlePayment(payment, event.data);
//     }

//     res.sendStatus(200);
//   } catch (error) {
//     console.error("WEBHOOK ERROR:", error);
//     res.sendStatus(500);
//   }
// };
// controller/paymentController.js
import crypto from "crypto";
import Payment from "../models/FeePayment.js";
import {
  paystack,
  secretKey,
  settlePayment,
  reconcilePendingPayments,
} from "../services/paystackService.js";
import {
  HttpError,
  getStudent,
  getSession,
  sendError,
} from "../utils/studentContext.js";
import { getFeeStatus } from "../services/feeService.js";

/* =====================================================
   WHAT DOES THE STUDENT OWE?
   GET /api/payments/status
===================================================== */

export const getPaymentStatus = async (req, res) => {
  try {
    const { student } = await getStudent(req);
    const session = await getSession(student);

    // Confirm any payment Paystack has already received but we haven't saved
    await reconcilePendingPayments(student._id);

    const fees = await getFeeStatus(student, session);

    res.status(200).json({
      success: true,
      session: session.name,
      semester: session.semester,
      ...fees,
    });
  } catch (error) {
    sendError(res, error);
  }
};

/* =====================================================
   START A PAYMENT
   POST /api/payments/initialize
   body: { feeCode: "TUITION", amount: 40000 }   (amount only for tuition)
===================================================== */

export const initializePayment = async (req, res) => {
  try {
    const { feeCode, amount } = req.body;

    const { student } = await getStudent(req);

    if (!student.email) {
      throw new HttpError(400, "Add an email address to your profile first");
    }

    const session = await getSession(student);
    const fees = await getFeeStatus(student, session);

    const item = fees.items.find((i) => i.code === feeCode);

    if (!item) {
      throw new HttpError(404, "This fee does not apply to you");
    }

    if (item.balance <= 0) {
      throw new HttpError(400, `${item.title} is already fully paid`);
    }

    // The server decides the amount. Only tuition may be part-paid.
    let payAmount = item.balance;

    if (item.partPayment) {
      payAmount = Number(amount);

      if (
        !Number.isInteger(payAmount) ||
        payAmount < 1 ||
        payAmount > item.balance
      ) {
        throw new HttpError(
          400,
          `Enter an amount between 1 and ${item.balance.toLocaleString()}`
        );
      }
    }

    const reference = `BRIT-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    await Payment.create({
      student: student._id,
      feeCode: item.code,
      title: item.title,
      session: session.name,
      semester: session.semester,
      amount: payAmount,
      reference,
    });

    const data = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: student.email,
        amount: payAmount * 100, // Naira -> kobo
        currency: "NGN",
        reference,
        callback_url: `${process.env.FRONTEND_URL}/student/dashboard/payment/callback`,
        metadata: {
          studentId: String(student._id),
          feeCode: item.code,
        },
      }),
    });

    res.status(200).json({
      success: true,
      authorizationUrl: data.authorization_url,
      reference,
    });
  } catch (error) {
    sendError(res, error);
  }
};

/* =====================================================
   CHECK A PAYMENT AFTER PAYSTACK REDIRECTS BACK
   GET /api/payments/verify/:reference
===================================================== */

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({
      reference,
      student: req.user.id, // a student can only check their own payments
    });

    if (!payment) {
      throw new HttpError(404, "Payment not found");
    }

    if (payment.status !== "success") {
      const data = await paystack(
        `/transaction/verify/${encodeURIComponent(reference)}`
      );
      await settlePayment(payment, data);
    }

    res.status(200).json({
      success: true,
      status: payment.status,
      title: payment.title,
      feeCode: payment.feeCode,
      amount: payment.amount,
    });
  } catch (error) {
    sendError(res, error);
  }
};

/* =====================================================
   PAYSTACK WEBHOOK (backup in case the student closes the tab)
   POST /api/payments/webhook
   Must be mounted with express.raw() BEFORE express.json() in server.js
===================================================== */

export const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];

    const hash = crypto
      .createHmac("sha512", secretKey())
      .update(req.body) // raw Buffer
      .digest("hex");

    if (hash !== signature) {
      return res.sendStatus(401);
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "charge.success") {
      const payment = await Payment.findOne({ reference: event.data.reference });
      if (payment) await settlePayment(payment, event.data);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    res.sendStatus(500);
  }
};