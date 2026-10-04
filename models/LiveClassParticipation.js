import mongoose from "mongoose";

// One document per student per class: tracks attendance AND replay progress.
const schema = new mongoose.Schema(
  {
    liveClass: { type: mongoose.Schema.Types.ObjectId, ref: "LiveClass", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, required: true },

    joinedLive: { type: Boolean, default: false },
    firstJoinedAt: Date,
    lastJoinedAt: Date,
    joinCount: { type: Number, default: 0 },

    replay: {
      positionSeconds: { type: Number, default: 0 },
      durationSeconds: { type: Number, default: 0 },
      completed: { type: Boolean, default: false },
      lastWatchedAt: Date,
    },
  },
  { timestamps: true }
);

schema.index({ liveClass: 1, student: 1 }, { unique: true });

export default mongoose.model("LiveClassParticipation", schema);
