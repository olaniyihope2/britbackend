
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

/* =====================================================
   WHAT DOES THE STUDENT OWE?
   GET /api/payments/status
===================================================== */


const markApplicationPaid = async (payment) => {
  if (
    payment.status === "success" &&
    payment.feeCode === "APPLICATION_FEE" &&
    payment.application
  ) {
    await Application.updateOne(
      { _id: payment.application, applicationFeePaid: false },
      { applicationFeePaid: true, applicationFeePaidAt: new Date() }
    );
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
await markApplicationPaid(payment);   // <-- outside the if

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
        await markApplicationPaid(payment);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    res.sendStatus(500);
  }
};