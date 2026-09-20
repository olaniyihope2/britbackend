// import mongoose from "mongoose";

// const userSchema = new mongoose.Schema(
//   {
//     role: {
//       type: String,
//       required: true,
//       enum: ["admin", "staff", "student"],
//     },
//     username: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     email: {
//       type: String,
//       unique: true,
//       sparse: true, // allows multiple docs without an email while still enforcing uniqueness when present
//     },
//     password: {
//       type: String,
//       required: true,
//     },
//     address: {
//       type: String,
//     },
//     phone: {
//       type: Number,
//     },
//     gender: {
//       type: String,
//       enum: ["male", "female"],
//     },
//     birthday: {
//       type: Date,
//     },

//     // ---------- staff-specific ----------
//     staffRole: {
//       type: String, // e.g. "Lecturer", "Registrar", "Bursar", "Admissions Officer"
//     },
//     department: {
//       type: String, // department/unit the staff member belongs to
//     },
//     subjectTaught: {
//       type: String, // kept for lecturers — course(s)/subject area they teach
//     },

//     // ---------- student-specific ----------
//     studentName: {
//       type: String,
//     },
//     matricNo: {
//       type: String, // replaces AdmNo — polytechnic matriculation number
//     },
//     programme: {
//       type: String, // e.g. "Accountancy with Digital & Cloud Accounting"
//     },
//     level: {
//       type: String, // e.g. "ND1", "ND2"
//       enum: ["ND1", "ND2"],
//     },
//     studyMode: {
//       type: String,
//       enum: ["full-time", "part-time"],
//     },

//     session: [{ type: mongoose.Schema.Types.ObjectId, ref: "Session" }],
//   },
//   { timestamps: true }
// );

// export default mongoose.model("User", userSchema);
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["admin", "staff", "student"],
    },
    username: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    address: { type: String },
    phone: { type: Number },
    gender: { type: String, enum: ["male", "female"] },
    birthday: { type: Date },

    // ---------- staff-specific ----------
    staffId: { type: String, unique: true, sparse: true },
    staffType: { type: String }, // "Lecturer" | "Academic Staff" | "Non-Academic Staff" | "Administrator"
    staffRole: { type: String }, // e.g. "Lecturer", "Registrar", "Bursar"

    // department is now a real reference, not free text
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },

    // Whether this staff member is the Head of Department.
    // HODs sit at department level and are not tied to one programme.
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

    // Shared by staff (the programme they teach under) and students
    // (the programme they're enrolled in) — now a real reference.
    programme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Programme",
    },

    session: [{ type: mongoose.Schema.Types.ObjectId, ref: "Session" }],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);