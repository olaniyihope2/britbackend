import mongoose from "mongoose";

const academicSessionSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },

      startDate: {
        type: Date,
        required: true,
      },

      endDate: {
        type: Date,
        required: true,
      },

      status: {
        type: String,
        enum: [
          "Upcoming",
          "Active",
          "Completed",
        ],
        default: "Upcoming",
      },
    },
    {
      timestamps: true,
    }
  );

const AcademicSession = mongoose.model(
  "AcademicSession",
  academicSessionSchema
);

export default AcademicSession;