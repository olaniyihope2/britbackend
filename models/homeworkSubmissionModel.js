import mongoose from "mongoose";

const homeworkSubmissionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, default: "" },
    prompt: { type: String, default: "" },
    answerText: { type: String, required: true },
    attachmentName: { type: String, default: "" },
    attachmentUrl: { type: String, default: "" },
    className: { type: String, default: "" },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentName: { type: String, default: "" },
    admissionNumber: { type: String, default: "" },
    grade: { type: String, default: "" },
    feedback: { type: String, default: "" },
    status: { type: String, enum: ["submitted", "graded"], default: "submitted" },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("HomeworkSubmission", homeworkSubmissionSchema);
