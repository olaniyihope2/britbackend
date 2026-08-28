import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // User who made the payment
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchUser",
      required: false, // Allow guest purchases by email
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // What they purchased
    articleId: {
      type: String,
      required: true, // publication slug or id
    },
    articleTitle: {
      type: String,
      required: true,
    },

    // Payment details
    amount: {
      type: Number,
      required: true, // stored in USD cents e.g. 999 = $9.99
    },
    currency: {
      type: String,
      default: "USD",
    },

    // Paystack data
    reference: {
      type: String,
      required: true,
      unique: true, // Paystack transaction reference
    },
    accessCode: {
      type: String, // Paystack access_code for inline popup
    },
    authorizationUrl: {
      type: String, // Paystack redirect URL (fallback)
    },
    paystackStatus: {
      type: String,
      enum: ["pending", "success", "failed", "abandoned"],
      default: "pending",
    },

    // Access control
    status: {
      type: String,
      enum: ["pending", "active", "expired", "refunded"],
      default: "pending",
    },
    accessGrantedAt: {
      type: Date,
      default: null,
    },

    // Webhook verification
    verifiedAt: {
      type: Date,
      default: null,
    },
    webhookData: {
      type: mongoose.Schema.Types.Mixed, // Raw Paystack webhook payload
      default: null,
    },
  },
  { timestamps: true }
);

// Index for quick lookup: "has this user/email paid for this article?"
paymentSchema.index({ email: 1, articleId: 1 });
paymentSchema.index({ reference: 1 });
paymentSchema.index({ userId: 1, articleId: 1 });

// Helper: check if access is active
paymentSchema.methods.hasAccess = function () {
  return this.status === "active";
};

export const SchPayment = mongoose.model("SchPayment", paymentSchema);
export const Payment = SchPayment; // alias