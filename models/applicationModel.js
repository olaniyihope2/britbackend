// models/applicationModel.js
import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    applicationNumber: { type: String, required: true, unique: true },
 programme: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Programme",
  required: true,
},

    status: {
      type: String,
      enum: ["Pending", "Submitted", "Approved", "Rejected"],
      default: "Pending",
    },

    applicationFee: { type: Number, default: 10000 },
    applicationFeePaid: { type: Boolean, default: false },
    applicationFeePaidAt: { type: Date },

    acceptanceFee: { type: Number, default: 40000 },
    acceptanceFeePaid: { type: Boolean, default: false },
    acceptanceFeePaidAt: { type: Date },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNotes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Application", applicationSchema);