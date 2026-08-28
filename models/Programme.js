import mongoose from "mongoose";

const programmeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    qualification: {
      type: String,
      enum: [
        "ND",
        "HND",
        "Certificate",
        "Diploma",
      ],
      required: true,
      default: "ND",
    },

    duration: {
      type: String,
      required: true,
      default: "2 Years",
    },

    description: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

const Programme = mongoose.model(
  "Programme",
  programmeSchema
);

export default Programme;