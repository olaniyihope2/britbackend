
import crypto from "crypto";
import Payment from "../models/FeePayment.js";
import Application from "../models/applicationModel.js";
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
import { getApplicationGate } from "../utils/applicationGate.js";

/* =====================================================
   WHAT DOES THE STUDENT OWE?
   GET /api/payments/status
===================================================== */


// const markApplicationPaid = async (payment) => {
//   if (
//     payment.status === "success" &&
//     payment.feeCode === "APPLICATION_FEE" &&
//     payment.application
//   )
  
//   {
//     await Application.updateOne(
//       { _id: payment.application, applicationFeePaid: false },
//       { applicationFeePaid: true, applicationFeePaidAt: new Date() }
//     );
//   }
// };

const settleAll = async (payments, paystackData) => {
  for (const p of payments) {
    if (p.status === "success") continue;
    // Paystack confirmed the whole batch; each line's amount is part of that total
    await settlePayment(p, {
      ...paystackData,
      reference: p.reference,
      amount: p.amount * 100,
    });
    await markApplicationPaid(p);
  }
};
export const markApplicationPaid = async (payment) => {
  if (payment.status !== "success" || !payment.application) return;
 
  const now = new Date();
 
  if (payment.feeCode === "APPLICATION_FEE") {
    await Application.updateOne(
      { _id: payment.application, applicationFeePaid: false },
      { applicationFeePaid: true, applicationFeePaidAt: now }
    );
  }
 
  if (payment.feeCode === "ACCEPTANCE_FEE") {
    await Application.updateOne(
      { _id: payment.application, acceptanceFeePaid: false },
      { acceptanceFeePaid: true, acceptanceFeePaidAt: now }
    );
  }
};


/* -----------------------------------------------------
   2. START ACCEPTANCE FEE PAYMENT
      POST /api/payments/acceptance-fee/:applicationId
----------------------------------------------------- */
export const initializeAcceptanceFeePayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { student } = await getStudent(req);
 
    const application = await Application.findById(applicationId);
 
    if (!application) {
      throw new HttpError(404, "Application not found");
    }
 
    if (String(application.user) !== String(student._id)) {
      throw new HttpError(403, "This is not your application");
    }
 
    // Only approved applications can pay the acceptance fee
    if (application.status !== "Approved") {
      throw new HttpError(
        400,
        "Your application must be approved before you can pay the acceptance fee"
      );
    }
 
    if (application.acceptanceFeePaid) {
      throw new HttpError(400, "Acceptance fee is already paid");
    }
 
    if (!student.email) {
      throw new HttpError(400, "Add an email address to your profile first");
    }
 
    // The server decides the amount, never the browser
    const acceptanceFee = application.acceptanceFee || 40000;
 
    const session = await getSession(student);
 
    const reference = `ACC-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}`;
 
    await Payment.create({
      student: student._id,
      application: application._id,
      feeCode: "ACCEPTANCE_FEE",
      title: `Acceptance Fee - ${application.applicationNumber}`,
      amount: acceptanceFee,
      reference,
      session: session.name,
      semester: session.semester,
    });
 
    const data = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: student.email,
        amount: acceptanceFee * 100, // Naira -> kobo
        currency: "NGN",
        reference,
        callback_url: `${process.env.FRONTEND_URL}/student/dashboard/payment/callback`,
        metadata: {
          studentId: String(student._id),
          applicationId: String(application._id),
          feeCode: "ACCEPTANCE_FEE",
          type: "acceptance",
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

export const initializeApplicationFeePayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { student } = await getStudent(req);

    // Find the application
    const application = await Application.findById(applicationId);

    if (!application) {
      throw new HttpError(404, "Application not found");
    }

    // Verify the application belongs to this student
    if (String(application.user) !== String(student._id)) {
      throw new HttpError(403, "This is not your application");
    }

    // Check if application fee is already paid
    if (application.applicationFeePaid) {
      throw new HttpError(400, "Application fee is already paid");
    }

    // Get the application fee amount
    const applicationFee = application.applicationFee || 5000;

    if (!student.email) {
      throw new HttpError(400, "Add an email address to your profile first");
    }

    // ✅ NEW: Get the current session
    const session = await getSession(student);

    const reference = `APP-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}`;

    // ✅ UPDATED: Include session and semester
    await Payment.create({
      student: student._id,
      application: application._id,
      feeCode: "APPLICATION_FEE",
      title: `Application Fee - ${application.applicationNumber}`,
      amount: applicationFee,
      reference,
      session: session.name,      // ✅ ADD THIS
      semester: session.semester,  // ✅ ADD THIS
    });

    // Initialize Paystack payment
    const data = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: student.email,
        amount: applicationFee * 100, // Naira -> kobo
        currency: "NGN",
        reference,
        callback_url: `${process.env.FRONTEND_URL}/student/dashboard/payment/callback`,
        metadata: {
          studentId: String(student._id),
          applicationId: String(application._id),
          feeCode: "APPLICATION_FEE",
          type: "application",
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
// export const getPaymentStatus = async (req, res) => {
//   try {
//     const { student } = await getStudent(req);
//     const session = await getSession(student);

//     // Confirm any payment Paystack has already received but we haven't saved
//     await reconcilePendingPayments(student._id);

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
export const getPaymentStatus = async (req, res) => {
  try {
    const { student } = await getStudent(req);
    const session = await getSession(student);

    await reconcilePendingPayments(student._id);

    const tuition = await getFeeStatus(student, session);
    const gate = await getApplicationGate(student._id, session._id);

    res.status(200).json({
      success: true,
      session: session.name,
      semester: session.semester,
      items: [...gate.items, ...tuition.items],
      eligible: tuition.eligible && gate.eligible,
      reason: gate.eligible ? "" : gate.reason,
      outstandingNow: gate.outstanding + (tuition.outstandingNow ?? 0),
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
// await markApplicationPaid(payment);   // <-- outside the if

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
export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const payments = await Payment.find({
      student: req.user.id,
      $or: [{ reference }, { batchReference: reference }],
    });

    if (payments.length === 0) {
      throw new HttpError(404, "Payment not found");
    }

    if (payments.some((p) => p.status !== "success")) {
      const data = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
      await settleAll(payments, data);
    }

    const fresh = await Payment.find({ _id: { $in: payments.map((p) => p._id) } });
    const allPaid = fresh.every((p) => p.status === "success");

    res.status(200).json({
      success: true,
      status: allPaid ? "success" : fresh.some((p) => p.status === "failed") ? "failed" : "pending",
      total: fresh.reduce((sum, p) => sum + p.amount, 0),
      items: fresh.map((p) => ({
        feeCode: p.feeCode,
        title: p.title,
        amount: p.amount,
        status: p.status,
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
};
export const verifyApplicationFeePayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({
      reference,
      student: req.user.id,
      feeCode: "APPLICATION_FEE",
    });

    if (!payment) {
      throw new HttpError(404, "Payment not found");
    }

    if (payment.status !== "success") {
      const data = await paystack(
        `/transaction/verify/${encodeURIComponent(reference)}`
      );
      await settlePayment(payment, data);
await markApplicationPaid(payment);   // <-- outside the if

      // If payment was successful, mark the application fee as paid
      if (payment.status === "success" && payment.application) {
        await Application.findByIdAndUpdate(
          payment.application,
          {
            applicationFeePaid: true,
            applicationFeePaidAt: new Date(),
          },
          { new: true }
        );
      }
    }

    res.status(200).json({
      success: true,
      status: payment.status,
      title: payment.title,
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
//         await markApplicationPaid(payment);
//     }

//     res.sendStatus(200);
//   } catch (error) {
//     console.error("WEBHOOK ERROR:", error);
//     res.sendStatus(500);
//   }
// };
export const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];

    const hash = crypto
      .createHmac("sha512", secretKey())
      .update(req.body)
      .digest("hex");

    if (hash !== signature) {
      return res.sendStatus(401);
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "charge.success") {
      const payments = await Payment.find({
        $or: [
          { reference: event.data.reference },
          { batchReference: event.data.reference },
        ],
      });
      if (payments.length) await settleAll(payments, event.data);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    res.sendStatus(500);
  }
};
/* =====================================================
   PAY SEVERAL FEES IN ONE CHARGE
   POST /api/payments/initialize-batch
   body: { items: [{ feeCode: "TUITION", amount: 20000 }, { feeCode: "APPLICATION_FEE" }] }
===================================================== */
export const initializeBatchPayment = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpError(400, "Select at least one fee to pay");
    }

    const codes = items.map((i) => i.feeCode);
    if (new Set(codes).size !== codes.length) {
      throw new HttpError(400, "Each fee can only be selected once");
    }

    const { student } = await getStudent(req);
    if (!student.email) {
      throw new HttpError(400, "Add an email address to your profile first");
    }

    const session = await getSession(student);
    await reconcilePendingPayments(student._id);

    // Build what the student can pay right now, from the server's own rules
    const tuition = await getFeeStatus(student, session);
    const gate = await getApplicationGate(student._id, session._id);

    const payable = new Map();
    for (const item of tuition.items) {
      if (item.balance > 0) payable.set(item.code, item);
    }
    for (const item of gate.items) {
      if (item.payable && item.balance > 0) payable.set(item.code, item);
    }

    // Validate every line and work out the amounts on the server
    const lines = [];
    let total = 0;

    for (const { feeCode, amount } of items) {
      const item = payable.get(feeCode);
      if (!item) {
        throw new HttpError(400, `${feeCode} cannot be paid right now`);
      }

      let payAmount = item.balance;

      if (item.partPayment) {
        payAmount = Number(amount);
        if (!Number.isInteger(payAmount) || payAmount < 1 || payAmount > item.balance) {
          throw new HttpError(
            400,
            `Enter an amount between 1 and ${item.balance.toLocaleString()} for ${item.title}`
          );
        }
      }

      lines.push({ item, payAmount });
      total += payAmount;
    }

    const batchRef = `BATCH-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // One payment row per fee, all sharing the batch reference
    for (const [index, { item, payAmount }] of lines.entries()) {
      await Payment.create({
        student: student._id,
        application: item.applicationId || undefined,
        feeCode: item.code,
        title: item.title,
        session: session.name,
        semester: session.semester,
        amount: payAmount,
        reference: `${batchRef}-${index + 1}`,
        batchReference: batchRef,
      });
    }

    const data = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: student.email,
        amount: total * 100,
        currency: "NGN",
        reference: batchRef,
        callback_url: `${process.env.FRONTEND_URL}/student/dashboard/payment/callback`,
        metadata: {
          studentId: String(student._id),
          batch: true,
          feeCodes: lines.map((l) => l.item.code),
        },
      }),
    });

    res.status(200).json({
      success: true,
      authorizationUrl: data.authorization_url,
      reference: batchRef,
      total,
    });
  } catch (error) {
    sendError(res, error);
  }
};