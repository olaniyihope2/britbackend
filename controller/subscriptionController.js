import axios from "axios";
import crypto from "crypto";
import { Subscription } from "../models/subscriptionModel.js";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const SUBSCRIPTION_AMOUNT_KOBO = 10000; // ₦25,000

// ─── 1. Initialize Subscription Payment ──────────────────────────────────────
// POST /api/subscription/initialize
export const initializeSubscription = async (req, res) => {
  try {
    const { email, userId, plan } = req.body;

    if (!email || !userId || !plan) {
      return res.status(400).json({
        success: false,
        message: "email, userId and plan are required",
      });
    }

    // If starter (free trial) — activate directly, no Paystack needed
    if (plan === "starter") {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 7);

      await Subscription.findOneAndUpdate(
        { userId },
        {
          userId, email, plan,
          status: "trialing",
          paperCreditsUsed: 0,    paperCreditsTotal: 5,
          datasetCreditsUsed: 0,  datasetCreditsTotal: 5,
          analysisCreditsUsed: 0, analysisCreditsTotal: 5,
          billingCycle: "monthly",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paystackReference: null,
          paystackStatus: "pending",
        },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        success: true,
        isFree: true,
        message: "Free trial activated",
      });
    }

    // Paid plan — initialize with Paystack
    const reference = `SUB-${userId.toString().slice(0, 8).toUpperCase()}-${Date.now()}`;

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: SUBSCRIPTION_AMOUNT_KOBO,
        currency: "NGN",
        reference,
        metadata: {
          userId: userId.toString(),
          plan,
          type: "subscription",
          custom_fields: [
            { display_name: "Plan",    variable_name: "plan",    value: plan },
            { display_name: "User ID", variable_name: "user_id", value: userId },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { access_code, authorization_url } = paystackRes.data.data;

    // Save a pending subscription record
    await Subscription.findOneAndUpdate(
      { userId },
      {
        userId, email, plan,
        status: "trialing",
        paystackReference: reference,
        paystackStatus: "pending",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(), // will be updated on verify
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      isFree: false,
      data: { reference, accessCode: access_code, authorizationUrl: authorization_url },
    });
  } catch (error) {
    console.error("Subscription init error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Subscription initialization failed",
    });
  }
};

// ─── 2. Verify & Activate Subscription ───────────────────────────────────────
// GET /api/subscription/verify/:reference
export const verifySubscription = async (req, res) => {
  try {
    const { reference } = req.params;

    // Find the pending subscription
    const subscription = await Subscription.findOne({ paystackReference: reference });
    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription record not found" });
    }

    // Already active — don't re-verify
    if (subscription.status === "active") {
      return res.status(200).json({ success: true, alreadyActive: true, message: "Already active" });
    }

    // Verify with Paystack
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const txData = paystackRes.data.data;

    if (txData.status !== "success") {
      subscription.paystackStatus = txData.status;
      await subscription.save();
      return res.status(402).json({
        success: false,
        message: `Payment ${txData.status}. Please try again.`,
      });
    }

    // Activate the subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    subscription.status               = "active";
    subscription.paystackStatus       = "success";
    subscription.paperCreditsUsed     = 0;
    subscription.paperCreditsTotal    = 25;
    subscription.datasetCreditsUsed   = 0;
    subscription.datasetCreditsTotal  = 25;
    subscription.analysisCreditsUsed  = 0;
    subscription.analysisCreditsTotal = 35;
    subscription.currentPeriodStart   = now;
    subscription.currentPeriodEnd     = periodEnd;
    await subscription.save();

    return res.status(200).json({ success: true, message: "Subscription activated" });
  } catch (error) {
    console.error("Subscription verify error:", error.message);
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
};

// ─── 3. Webhook ───────────────────────────────────────────────────────────────
// POST /api/subscription/webhook
export const subscriptionWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    // Respond immediately so Paystack doesn't retry
    res.status(200).json({ received: true });

    const { event, data } = req.body;

    if (event === "charge.success") {
      const meta = data.metadata;
      if (meta?.type !== "subscription") return;

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      await Subscription.findOneAndUpdate(
        { paystackReference: data.reference },
        {
          status: "active",
          paystackStatus: "success",
          paperCreditsTotal: 25,
          datasetCreditsTotal: 25,
          analysisCreditsTotal: 35,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          webhookData: data,
        },
        { new: true }
      );

      console.log(`✅ Subscription activated via webhook for user ${meta.userId}`);
    }

    if (event === "charge.failed") {
      await Subscription.findOneAndUpdate(
        { paystackReference: data.reference },
        { paystackStatus: "failed", webhookData: data }
      );
    }
  } catch (error) {
    console.error("Subscription webhook error:", error.message);
  }
};

// ─── 4. Check Subscription Status ────────────────────────────────────────────
// GET /api/subscription/status?userId=xxx
export const checkSubscription = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }

    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(200).json({ success: true, isSubscribed: false });
    }

    // Auto-expire if period has ended
    if (
      subscription.status === "active" &&
      new Date(subscription.currentPeriodEnd) < new Date()
    ) {
      subscription.status = "expired";
      await subscription.save();
      return res.status(200).json({ success: true, isSubscribed: false });
    }

    const isSubscribed =
      (subscription.status === "active" || subscription.status === "trialing") &&
      new Date(subscription.currentPeriodEnd) > new Date();

    return res.status(200).json({
      success: true,
      isSubscribed,
      subscription: isSubscribed ? subscription : null,
    });
  } catch (error) {
    console.error("Check subscription error:", error.message);
    return res.status(500).json({ success: false, message: "Status check failed" });
  }
};