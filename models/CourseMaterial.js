import mongoose from "mongoose";

const courseMaterialSchema = new mongoose.Schema(
  {
    allocation: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAllocation", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: {
      type: String,
      enum: [
        "Lecture Note", "Lecture Slides", "Assignment", "Reading Material",
        "Video", "Past Question", "Reference Material", "Other",
      ],
      default: "Lecture Note",
    },

    originalName: { type: String, required: true },
    fileKey: { type: String, required: true }, // S3 object key
    mimeType: { type: String },
    size: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model("CourseMaterial", courseMaterialSchema);