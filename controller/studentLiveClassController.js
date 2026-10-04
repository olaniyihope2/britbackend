import mongoose from "mongoose";
import LiveClass from "../models/LiveClass.js";
import LiveClassParticipation from "../models/LiveClassParticipation.js";
import { getEnrolledCourseIds, isEnrolled } from "../utils/enrollment.js";
import { getStaffInfo, getStudentInfo } from "../utils/peopleInfo.js";
import { getStreamUrl } from "../utils/s3Presign.js";
import { buildJoinInfo } from "../utils/jitsiToken.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Loads a class the student is registered for; sends the error itself otherwise.
const loadForStudent = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ message: "Invalid class ID" });
    return null;
  }
  const liveClass = await LiveClass.findById(req.params.id).populate("course", "code title");
  if (!liveClass) {
    res.status(404).json({ message: "Live class not found" });
    return null;
  }
  const courseId = liveClass.course?._id || liveClass.course;
  if (!(await isEnrolled(req.user.userId, courseId))) {
    res.status(403).json({ message: "You are not registered for this course" });
    return null;
  }
  return liveClass;
};

const shape = (c, lecturer, part) => {
  const attended = Boolean(part?.joinedLive);
  const dur = part?.replay?.durationSeconds || 0;
  return {
    _id: c._id,
    title: c.title,
    description: c.description,
    course: c.course,
    lecturer: lecturer?.name || "",
    status: c.status,
    scheduledAt: c.scheduledAt,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    durationMinutes: c.durationMinutes,
    hasReplay: c.recording?.status === "ready",
    attended,
    missed: c.status === "ended" && !attended,
    replay: part?.replay?.lastWatchedAt
      ? {
          positionSeconds: part.replay.positionSeconds,
          durationSeconds: dur,
          completed: part.replay.completed,
          percent: dur ? Math.min(100, Math.round((part.replay.positionSeconds / dur) * 100)) : 0,
        }
      : null,
  };
};

/* LIST: live now, upcoming, and past classes with replay -------------- */
export const getStudentLiveClasses = async (req, res) => {
  try {
    const courseIds = await getEnrolledCourseIds(req.user.userId);
    const classes = await LiveClass.find({ course: { $in: courseIds } })
      .populate("course", "code title")
      .sort({ scheduledAt: -1 });

    const parts = await LiveClassParticipation.find({
      student: req.user.userId,
      liveClass: { $in: classes.map((c) => c._id) },
    });
    const partMap = new Map(parts.map((p) => [String(p.liveClass), p]));
    const staff = await getStaffInfo([...new Set(classes.map((c) => String(c.createdBy)))]);

    return res.status(200).json({
      liveClasses: classes.map((c) =>
        shape(c, staff.get(String(c.createdBy)), partMap.get(String(c._id)))
      ),
    });
  } catch (error) {
    console.error("Student live classes error:", error);
    return res.status(500).json({ message: "Failed to load classes" });
  }
};

/* JOIN a live class (logs attendance, returns the room + token) -------- */
export const joinLiveClass = async (req, res) => {
  try {
    const liveClass = await loadForStudent(req, res);
    if (!liveClass) return;
    if (liveClass.status !== "live")
      return res.status(400).json({
        message:
          liveClass.status === "ended"
            ? "This class has ended. Watch the replay instead."
            : "This class has not started yet",
      });

    await LiveClassParticipation.findOneAndUpdate(
      { liveClass: liveClass._id, student: req.user.userId },
      {
        $set: { joinedLive: true, lastJoinedAt: new Date() },
        $setOnInsert: { firstJoinedAt: new Date() },
        $inc: { joinCount: 1 },
      },
      { upsert: true, new: true }
    );

    const info = await getStudentInfo([req.user.userId]);
    const me = info.get(String(req.user.userId)) || { name: "Student", email: "" };

    return res.status(200).json({
      join: buildJoinInfo({
        roomName: liveClass.roomName,
        userId: req.user.userId,
        name: me.name,
        email: me.email,
        moderator: false,
      }),
    });
  } catch (error) {
    console.error("Student join error:", error);
    return res.status(500).json({ message: "Failed to join the class" });
  }
};

/* REPLAY: presigned playback URL + where the student stopped ----------- */
export const getReplay = async (req, res) => {
  try {
    const liveClass = await loadForStudent(req, res);
    if (!liveClass) return;
    if (liveClass.recording?.status !== "ready" || !liveClass.recording.fileKey)
      return res.status(404).json({ message: "No recording is available for this class yet" });

    const url = await getStreamUrl(liveClass.recording.fileKey);
    const part = await LiveClassParticipation.findOne({
      liveClass: liveClass._id,
      student: req.user.userId,
    });

    return res.status(200).json({
      url,
      mimeType: liveClass.recording.mimeType,
      title: liveClass.title,
      durationSeconds: liveClass.recording.durationSeconds,
      resumeAt: part?.replay?.completed ? 0 : part?.replay?.positionSeconds || 0,
    });
  } catch (error) {
    console.error("Replay error:", error);
    return res.status(500).json({ message: "Failed to load the recording" });
  }
};

/* PROGRESS: the player reports position every ~15s ----------------------- */
export const saveReplayProgress = async (req, res) => {
  try {
    const liveClass = await loadForStudent(req, res);
    if (!liveClass) return;

    const position = Number(req.body.positionSeconds);
    const duration = Number(req.body.durationSeconds);
    if (!Number.isFinite(position) || position < 0)
      return res.status(400).json({ message: "Invalid position" });

    let part = await LiveClassParticipation.findOne({
      liveClass: liveClass._id,
      student: req.user.userId,
    });
    if (!part)
      part = new LiveClassParticipation({ liveClass: liveClass._id, student: req.user.userId });

    const dur = Number.isFinite(duration) && duration > 0 ? duration : part.replay.durationSeconds;
    part.replay.positionSeconds = position;
    part.replay.durationSeconds = dur || 0;
    part.replay.lastWatchedAt = new Date();
    // once completed, stays completed
    if (dur && position / dur >= 0.9) part.replay.completed = true;

    await part.save();
    return res.status(200).json({ ok: true, completed: part.replay.completed });
  } catch (error) {
    console.error("Replay progress error:", error);
    return res.status(500).json({ message: "Failed to save progress" });
  }
};
