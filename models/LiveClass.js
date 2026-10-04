import mongoose from "mongoose";

const recordingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["none", "uploading", "ready", "failed"],
      default: "none",
    },
    fileKey: String, // S3 key, never sent to the browser
    fileName: String,
    mimeType: String,
    size: Number,
    durationSeconds: Number,
    source: { type: String, enum: ["browser", "server", "upload"], default: "browser" },
    uploadedAt: Date,
  },
  { _id: false }
);

const liveClassSchema = new mongoose.Schema(
  {
    allocation: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAllocation", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    programme: { type: mongoose.Schema.Types.ObjectId, ref: "Programme" },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession" },
    level: String,
    semester: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    scheduledAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
      index: true,
    },
    startedAt: Date,
    endedAt: Date,
    durationMinutes: Number,

    // Unguessable room id. Only returned through the /join endpoints.
    roomName: { type: String, required: true, unique: true },

    recording: { type: recordingSchema, default: () => ({ status: "none" }) },
  },
  { timestamps: true }
);

liveClassSchema.index({ course: 1, scheduledAt: -1 });

export default mongoose.model("LiveClass", liveClassSchema);
