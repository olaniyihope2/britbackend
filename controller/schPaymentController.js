import axios from "axios";
import crypto from "crypto";
import { SchPayment } from "../models/schPaymentModel.js" // ✅
import { Payment }    from "../models/schPaymentModel.js" // ✅ also works

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY; // set in .env
const ARTICLE_PRICE_NGN = 100;

// ─── Helper: generate unique reference ───────────────────────────────────────

function generateReference(articleId) {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AS-${articleId.slice(0, 6).toUpperCase()}-${timestamp}-${rand}`;
}

// ─── 1. Initialize Payment ────────────────────────────────────────────────────
// POST /api/payments/initialize
// Body: { email, articleId, articleTitle }
// Called when user clicks "Purchase Full Access"

export const initializePayment = async (req, res) => {
  try {
    const { email, articleId, articleTitle } = req.body;

    if (!email || !articleId || !articleTitle) {
      return res.status(400).json({
        success: false,
        message: "email, articleId and articleTitle are required",
      });
    }
// Check active access
const existingAccess = await SchPayment.findOne({
  email: email.toLowerCase(),
  articleId,
  status: "active",
});
if (existingAccess) {
  return res.status(200).json({ success: true, alreadyPaid: true });
}

// ✅ ADD THIS — reuse existing pending payment
const existingPending = await SchPayment.findOne({
  email: email.toLowerCase(),
  articleId,
  status: "pending",
});
if (existingPending) {
  return res.status(200).json({
    success: true,
    data: {
      reference: existingPending.reference,
      accessCode: existingPending.accessCode,
      authorizationUrl: existingPending.authorizationUrl,
      paymentId: existingPending._id,
    },
  });
}

// Only then generate a new reference
const reference = generateReference(articleId);

    // Amount in kobo/cents — Paystack expects smallest currency unit
    // $9.99 USD → 999 cents. For NGN you'd multiply by 100 for kobo
    const amountInKobo = Math.round(ARTICLE_PRICE_NGN * 100); // 999

    // Call Paystack initialize endpoint
    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
   amount: amountInKobo,
        currency: "NGN",       // change to "NGN" if charging in naira
        reference,
        metadata: {
          articleId,
          articleTitle,
          custom_fields: [
            {
              display_name: "Article",
              variable_name: "article_title",
              value: articleTitle,
            },
          ],
        },
        callback_url: `${process.env.FRONTEND_URL}/publications/access?ref=${reference}`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { access_code, authorization_url } = paystackRes.data.data;

    // Save pending payment record in DB
    const payment = await SchPayment.create({
      userId: req.user?._id || null, // attach user if logged in
      email: email.toLowerCase(),
      articleId,
      articleTitle,
      amount: amountInKobo,
      currency: "USD",
      reference,
      accessCode: access_code,
      authorizationUrl: authorization_url,
      paystackStatus: "pending",
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      data: {
        reference,
        accessCode: access_code,       // used by Paystack inline popup
        authorizationUrl: authorization_url, // fallback redirect
        paymentId: payment._id,
      },
    });
  } catch (error) {
    console.error("Paystack initialize error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Payment initialization failed",
      error: error.response?.data?.message || error.message,
    });
  }
};

// ─── 2. Verify Payment ────────────────────────────────────────────────────────
// GET /api/payments/verify/:reference
// Called after Paystack redirects back or user returns to page

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ success: false, message: "Reference is required" });
    }

    // Find our payment record first
    const payment = await SchPayment.findOne({ reference });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    // Already verified — return cached result
    if (payment.status === "active") {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: "Payment already verified",
        articleId: payment.articleId,
      });
    }

    // Call Paystack verify endpoint
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    const txData = paystackRes.data.data;

    if (txData.status === "success") {
      // Grant access
      payment.paystackStatus = "success";
      payment.status = "active";
      payment.accessGrantedAt = new Date();
      payment.verifiedAt = new Date();
      await payment.save();

      return res.status(200).json({
        success: true,
        message: "Payment verified. Access granted.",
        articleId: payment.articleId,
        articleTitle: payment.articleTitle,
      });
    } else {
      // Payment failed or abandoned
      payment.paystackStatus = txData.status; // "failed" | "abandoned"
      await payment.save();

      return res.status(402).json({
        success: false,
        message: `Payment ${txData.status}. Please try again.`,
      });
    }
  } catch (error) {
    console.error("Paystack verify error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.response?.data?.message || error.message,
    });
  }
};

// ─── 3. Paystack Webhook ──────────────────────────────────────────────────────
// POST /api/payments/webhook
// Paystack calls this automatically on payment events
// ⚠️  This route must skip JWT auth middleware but MUST verify Paystack signature

export const paystackWebhook = async (req, res) => {
  try {
    // 1. Verify the request is genuinely from Paystack
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    // 2. Always respond 200 immediately — Paystack retries if you don't
    res.status(200).json({ received: true });

    // 3. Process the event asynchronously
    const { event, data } = req.body;

    if (event === "charge.success") {
      const { reference } = data;

      const payment = await SchPayment.findOne({ reference });
      if (!payment) {
        console.error(`Webhook: No payment found for reference ${reference}`);
        return;
      }

      // Avoid double-processing
      if (payment.status === "active") return;

      payment.paystackStatus = "success";
      payment.status = "active";
      payment.accessGrantedAt = new Date();
      payment.verifiedAt = new Date();
      payment.webhookData = data;
      await payment.save();

      console.log(`✅ Webhook: Access granted for ${payment.email} → ${payment.articleTitle}`);
    }

    if (event === "charge.failed") {
      const { reference } = data;
      await Payment.findOneAndUpdate(
        { reference },
        { paystackStatus: "failed", webhookData: data }
      );
    }
  } catch (error) {
    console.error("Webhook processing error:", error.message);
    // Don't send error response — Paystack already got 200
  }
};

// ─── 4. Check Access ──────────────────────────────────────────────────────────
// GET /api/payments/access?email=xxx&articleId=yyy
// Frontend calls this on page load to see if user already paid

export const checkAccess = async (req, res) => {
  try {
    const { email, articleId } = req.query;

    if (!email || !articleId) {
      return res.status(400).json({ success: false, message: "email and articleId are required" });
    }

    const payment = await SchPayment.findOne({
      email: email.toLowerCase(),
      articleId,
      status: "active",
    });

    return res.status(200).json({
      success: true,
      hasAccess: !!payment,
      grantedAt: payment?.accessGrantedAt || null,
    });
  } catch (error) {
    console.error("Check access error:", error.message);
    return res.status(500).json({ success: false, message: "Access check failed" });
  }
};
