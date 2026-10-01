import mongoose from "mongoose";

const credentialSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    credentialType: {
      type: String,
      required: true,
      enum: ["WASSCE", "NECO", "NABTEC", "JAMB Result", "Birth Certificate",
             "State of Origin", "Passport Photograph", "Other"],
    },
    examYear: { type: String },
    examNumber: { type: String },

fileName: { type: String, required: true },
fileKey:  { type: String, required: true },   // S3 object key (replaces filePath)
mimeType: { type: String },
fileSize: { type: Number }, // where it is stored
 

    status: {
      type: String,
      enum: ["Pending Verification", "Verified", "Rejected", "Issue Found"],
      default: "Pending Verification",
    },
    remark: { type: String },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Credential", credentialSchema);