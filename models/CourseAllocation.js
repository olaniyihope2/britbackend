import mongoose from "mongoose";

const courseAllocationSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    level: {
      type: String,
      enum: ["ND 1", "ND 2", "HND 1", "HND 2"],
      required: true,
    },

    semester: {
      type: String,
      enum: ["First Semester", "Second Semester"],
      required: true,
    },

    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },

    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

/*
  Prevent duplicate lecturer assignment
*/
courseAllocationSchema.index(
  { staff: 1, course: 1, academicSession: 1 },
  { unique: true }
);

export default mongoose.model("CourseAllocation", courseAllocationSchema);