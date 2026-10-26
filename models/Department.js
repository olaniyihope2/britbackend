import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: { type: String, default: "" },

    // Absorbed from the old Programme model
    qualification: {
      type: String,
      enum: ["ND", "HND", "Certificate", "Diploma", "Short Course"],
      default: "ND",
    },
    duration: { type: String, default: "2 Years" },

    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },

    // Set/updated automatically when a staff record is
    // registered or edited with isHOD: true.
    headOfDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Department", departmentSchema);