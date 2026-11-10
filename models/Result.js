import mongoose from "mongoose";
import { CA_MAX, EXAM_MAX, gradeFor } from "../utils/grading.js";

const ref = (name) => ({ type: mongoose.Schema.Types.ObjectId, ref: name });

const resultSchema = new mongoose.Schema(
  {
    student: { ...ref("User"), required: true },
    allocation: { ...ref("CourseAllocation"), required: true },
    course: { ...ref("Course"), required: true },
    academicSession: { ...ref("Session"), required: true },
    semester: { type: String, enum: ["First", "Second"], required: true },
    level: { type: String, default: "" },

    // Snapshot taken when the row is first created
    creditUnits: { type: Number, required: true, min: 0 },

    caScore: { type: Number, min: 0, max: CA_MAX, default: null },
    examScore: { type: Number, min: 0, max: EXAM_MAX, default: null },
    total: { type: Number, default: null },
    grade: { type: String, default: null },
    gradePoint: { type: Number, default: null },
    comment: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "published"],
      default: "draft",
    },
    enteredBy: ref("User"),
    submittedAt: { type: Date, default: null },
    approvedBy: ref("User"),
    approvedAt: { type: Date, default: null },
    publishedBy: ref("User"),
    publishedAt: { type: Date, default: null },
    returnReason: { type: String, default: "" },
  },
  { timestamps: true }
);

resultSchema.index({ student: 1, allocation: 1 }, { unique: true });
resultSchema.index({ allocation: 1, status: 1 });
resultSchema.index({ student: 1, status: 1 });

// The server is the only place totals and grades are set
resultSchema.pre("validate", function (next) {
  if (this.caScore != null && this.examScore != null) {
    this.total = this.caScore + this.examScore;
    const g = gradeFor(this.total);
    this.grade = g.grade;
    this.gradePoint = g.point;
  } else {
    this.total = null;
    this.grade = null;
    this.gradePoint = null;
  }
  next();
});

export default mongoose.model("Result", resultSchema);