import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    allocation: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAllocation", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    programme: { type: mongoose.Schema.Types.ObjectId, ref: "Programme" },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "Session" }, // "Session", not "AcademicSession"
    level: { type: String },
    semester: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, default: "" },
    dueDate: { type: Date, required: true },
    maxMarks: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["draft", "published", "closed"], default: "draft" },

    attachment: {
      fileName: String,
      fileKey: String, // S3 object key, never sent to the browser
      mimeType: String,
      size: Number,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ allocation: 1, createdAt: -1 });

export default mongoose.model("Assignment", assignmentSchema);