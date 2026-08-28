import mongoose from "mongoose";

const pinSchema = new mongoose.Schema({
  pin: { type: String, required: true, unique: true },
  serial: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const Pin = mongoose.model("Pin", pinSchema);
