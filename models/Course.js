import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },

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

    credits: { type: Number, required: true, min: 1, max: 12, default: 3 },

    type: {
      type: String,
      enum: ["Compulsory", "Elective"],
      default: "Compulsory",
    },

    status: {
      type: String,
      enum: ["Approved", "Draft", "Inactive"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

/*
  The same course code can exist in different departments (e.g. a general
  course like GNS 101), but cannot be duplicated within the same
  department, level and semester.
*/
courseSchema.index(
  { code: 1, department: 1, level: 1, semester: 1 },
  { unique: true }
);

export default mongoose.model("Course", courseSchema);