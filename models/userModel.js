import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["admin", "staff", "student"],
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs without an email while still enforcing uniqueness when present
    },
    password: {
      type: String,
      required: true,
    },
    address: {
      type: String,
    },
    phone: {
      type: Number,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    birthday: {
      type: Date,
    },

    // ---------- staff-specific ----------
    staffRole: {
      type: String, // e.g. "Lecturer", "Registrar", "Bursar", "Admissions Officer"
    },
    department: {
      type: String, // department/unit the staff member belongs to
    },
    subjectTaught: {
      type: String, // kept for lecturers — course(s)/subject area they teach
    },

    // ---------- student-specific ----------
    studentName: {
      type: String,
    },
    matricNo: {
      type: String, // replaces AdmNo — polytechnic matriculation number
    },
    programme: {
      type: String, // e.g. "Accountancy with Digital & Cloud Accounting"
    },
    level: {
      type: String, // e.g. "ND1", "ND2"
      enum: ["ND1", "ND2"],
    },
    studyMode: {
      type: String,
      enum: ["full-time", "part-time"],
    },

    session: [{ type: mongoose.Schema.Types.ObjectId, ref: "Session" }],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
