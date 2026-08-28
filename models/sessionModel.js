
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., 2026/2027
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: false }, // marks the current active session
  currentSemester: {
    type: String,
    enum: ["First", "Second"],
    default: "First",
  },
});

export default mongoose.model("Session", sessionSchema);