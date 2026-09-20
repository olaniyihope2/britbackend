// models/CourseRegistration.js
import mongoose from "mongoose";

const courseRegistrationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    programme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Programme",
      required: true,
    },

    level: {
      type: String,
      enum: ["ND 1", "ND 2", "HND 1", "HND 2"],
      required: true,
    },

    session: {
      type: String, // e.g. "2025/2026"
      required: true,
    },

    semester: {
      type: String,
      enum: ["First Semester", "Second Semester"],
      required: true,
    },

    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],

    totalUnits: {
      type: Number,
      required: true,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending Payment", "Registered"],
      default: "Pending Payment",
    },

    // Filled in after a successful payment
    paymentReference: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

/*
  One registration per student, per session, per semester.
*/
courseRegistrationSchema.index(
  { student: 1, session: 1, semester: 1 },
  { unique: true }
);

const CourseRegistration = mongoose.model(
  "CourseRegistration",
  courseRegistrationSchema
);

export default CourseRegistration;