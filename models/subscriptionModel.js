import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchUser",
      required: true,
      unique: true, // one active subscription per user
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    plan: {
      type: String,
      enum: ["starter", "researcher", "institutional"],
      required: true,
    },
    status: {
      type: String,
      enum: ["trialing", "active", "expired", "cancelled"],
      default: "trialing",
    },

    // Credits
    paperCreditsUsed:     { type: Number, default: 0 },
    paperCreditsTotal:    { type: Number, default: 5 },
    datasetCreditsUsed:   { type: Number, default: 0 },
    datasetCreditsTotal:  { type: Number, default: 5 },
    analysisCreditsUsed:  { type: Number, default: 0 },
    analysisCreditsTotal: { type: Number, default: 5 },

    // Billing
    billingCycle: {
      type: String,
      default: "monthly",
    },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd:   { type: Date },

    // Paystack
    paystackReference: { type: String, default: null },
    paystackStatus: {
      type: String,
      enum: ["pending", "success", "failed", "abandoned"],
      default: "pending",
    },
    webhookData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ email: 1 });
subscriptionSchema.index({ paystackReference: 1 });

// Helper: is subscription currently active?
subscriptionSchema.methods.isActive = function () {
  return (
    (this.status === "active" || this.status === "trialing") &&
    new Date(this.currentPeriodEnd) > new Date()
  );
};

export const Subscription = mongoose.model("Subscription", subscriptionSchema);