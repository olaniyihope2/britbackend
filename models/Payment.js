// models/Payment.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // e.g. "TUITION", "MEDICAL", "ACCEPTANCE" (see services/feeService.js)
    feeCode: {
      type: String,
      required: true,
    },

    title: {
      type: String,
    },

    session: {
      type: String, // e.g. "2026/2027"
      required: true,
    },

    semester: {
      type: String,
      required: true,
    },

    // Amount in Naira (Paystack gets it in kobo, x100)
    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },

    paidAt: {
      type: Date,
    },

    channel: {
      type: String, // card, bank_transfer, ...
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
