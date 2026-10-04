import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, required: true }, // same id as req.user.userId
    text: { type: String, default: "" },
    attachment: {
      fileName: String,
      fileKey: String,
      mimeType: String,
      size: Number,
    },
    status: { type: String, enum: ["Submitted", "Graded"], default: "Submitted" },
    score: Number,
    feedback: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One submission per student per assignment (resubmitting updates it)
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

export default mongoose.model("AssignmentSubmission", submissionSchema);