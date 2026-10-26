import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, enum: ["admin", "staff", "student"] },
    username: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    address: { type: String },
    phone: { type: Number },
    gender: { type: String, enum: ["male", "female"] },
    birthday: { type: Date },

    // Shared: the department a staff member belongs to,
    // or the department a student is enrolled in.
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },

    // ---------- staff-specific ----------
    staffId: { type: String, unique: true, sparse: true },
    staffType: { type: String }, // "Lecturer" | "Academic Staff" | "Non-Academic Staff" | "Administrator"
    staffRole: { type: String }, // e.g. "Lecturer", "Registrar", "Bursar"
    isHOD: { type: Boolean, default: false },
    subjectTaught: { type: String },
    employmentType: { type: String },
    employmentDate: { type: Date },
    status: {
      type: String,
      enum: ["Active", "Pending", "Inactive"],
      default: "Active",
    },

    // ---------- student-specific ----------
    studentName: { type: String },
    matricNo: { type: String },
    level: { type: String, enum: ["ND1", "ND2"] },
    studyMode: { type: String, enum: ["full-time", "part-time"] },
    isNewStudent: { type: Boolean, default: false },
    isInternational: { type: Boolean, default: false },
    scholarship: { type: String, enum: ["none", "half", "full"], default: "none" },

    session: [{ type: mongoose.Schema.Types.ObjectId, ref: "Session" }],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);