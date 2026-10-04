import crypto from "crypto";
import mongoose from "mongoose";
import LiveClass from "../models/LiveClass.js";
import LiveClassParticipation from "../models/LiveClassParticipation.js";
import CourseAllocation from "../models/CourseAllocation.js";
import { deleteFromS3 } from "../utils/s3.js";
import { getUploadUrl, headObject } from "../utils/s3Presign.js";
import { getEnrolledStudentIds } from "../utils/enrollment.js";
import { getStudentInfo, getStaffInfo } from "../utils/peopleInfo.js";
import { buildJoinInfo } from "../utils/jitsiToken.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const MAX_RECORDING_BYTES = 5 * 1024 * 1024 * 1024; // single presigned PUT limit (5 GB)

const canManage = (allocation, req) =>
  req.isAdmin || String(allocation.staff) === String(req.user.userId);

const withRefs = (q) =>
  q.populate("course", "code title").populate("programme", "name code").populate("academicSession", "name");

// Never expose the S3 key or the room name in lists
const serialize = (doc) => {
  const o = doc.toObject();
  delete o.roomName;
  o.hasRecording = o.recording?.status === "ready";
  if (o.recording) {
    o.recording = {
      status: o.recording.status,
      fileName: o.recording.fileName,
      size: o.recording.size,
      durationSeconds: o.recording.durationSeconds,
      source: o.recording.source,
    };
  }
  return o;
};

// Loads a class the caller manages; sends the error itself and returns null otherwise.
const loadManaged = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ message: "Invalid class ID" });
    return null;
  }
  const liveClass = await LiveClass.findById(req.params.id);
  if (!liveClass) {
    res.status(404).json({ message: "Live class not found" });
    return null;
  }
  const allocation = await CourseAllocation.findById(liveClass.allocation);
  if (!allocation || !canManage(allocation, req)) {
    res.status(403).json({ message: "Not allowed" });
    return null;
  }
  return liveClass;
};

/* LIST (lecturer's own classes + their active courses) -------------- */
export const getMyLiveClasses = async (req, res) => {
  try {
    const mine = await CourseAllocation.find({ staff: req.user.userId }).select("_id");
    const liveClasses = await withRefs(
      LiveClass.find({ allocation: { $in: mine.map((a) => a._id) } }).sort({ scheduledAt: -1 })
    );

    const allocations = await CourseAllocation.find({ staff: req.user.userId, status: "Active" })
      .populate("course", "code title credits")
      .populate("programme", "name code")
      .populate("academicSession", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ liveClasses: liveClasses.map(serialize), allocations });
  } catch (error) {
    console.error("Get live classes error:", error);
    return res.status(500).json({ message: "Failed to load live classes" });
  }
};

/* CREATE ------------------------------------------------------------- */
export const createLiveClass = async (req, res) => {
  try {
    const { allocationId, title, description, scheduledAt } = req.body;

    if (!isValidId(allocationId)) return res.status(400).json({ message: "Select a course" });
    const allocation = await CourseAllocation.findById(allocationId);
    if (!allocation) return res.status(404).json({ message: "Course allocation not found" });
    if (!canManage(allocation, req))
      return res.status(403).json({ message: "This course is not assigned to you" });
    if (allocation.status !== "Active" && !req.isAdmin)
      return res.status(400).json({ message: "This course allocation is not active" });
    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

    const when = scheduledAt ? new Date(scheduledAt) : new Date();
    if (Number.isNaN(when.getTime()))
      return res.status(400).json({ message: "A valid date and time is required" });

    const liveClass = await LiveClass.create({
      allocation: allocation._id,
      course: allocation.course,
      programme: allocation.programme,
      academicSession: allocation.academicSession,
      level: allocation.level,
      semester: allocation.semester,
      createdBy: req.user.userId,
      title: title.trim(),
      description: description?.trim() || "",
      scheduledAt: when,
      roomName: `bta-${crypto.randomBytes(9).toString("hex")}`,
    });

    const populated = await withRefs(LiveClass.findById(liveClass._id));
    return res.status(201).json({ message: "Live class created", liveClass: serialize(populated) });
  } catch (error) {
    console.error("Create live class error:", error);
    return res.status(500).json({ message: "Failed to create live class" });
  }
};

/* UPDATE (only before it starts) ------------------------------------ */
export const updateLiveClass = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;
    if (liveClass.status !== "scheduled")
      return res.status(400).json({ message: "Only scheduled classes can be edited" });

    const { title, description, scheduledAt } = req.body;
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "Title cannot be empty" });
      liveClass.title = title.trim();
    }
    if (description !== undefined) liveClass.description = description.trim();
    if (scheduledAt !== undefined) {
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime()))
        return res.status(400).json({ message: "A valid date and time is required" });
      liveClass.scheduledAt = when;
    }
    await liveClass.save();

    const populated = await withRefs(LiveClass.findById(liveClass._id));
    return res.status(200).json({ message: "Live class updated", liveClass: serialize(populated) });
  } catch (error) {
    console.error("Update live class error:", error);
    return res.status(500).json({ message: "Failed to update live class" });
  }
};

/* START / END ------------------------------------------------------- */
export const startLiveClass = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;
    if (liveClass.status === "live") return res.status(200).json({ message: "Already live" });
    if (liveClass.status === "ended")
      return res.status(400).json({ message: "This class has already ended" });

    liveClass.status = "live";
    liveClass.startedAt = new Date();
    await liveClass.save();

    const populated = await withRefs(LiveClass.findById(liveClass._id));
    return res.status(200).json({ message: "Class is live", liveClass: serialize(populated) });
  } catch (error) {
    console.error("Start live class error:", error);
    return res.status(500).json({ message: "Failed to start the class" });
  }
};

export const endLiveClass = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;
    if (liveClass.status !== "live")
      return res.status(400).json({ message: "Only a live class can be ended" });

    liveClass.status = "ended";
    liveClass.endedAt = new Date();
    liveClass.durationMinutes = Math.max(
      1,
      Math.round((liveClass.endedAt - (liveClass.startedAt || liveClass.endedAt)) / 60000)
    );
    await liveClass.save();

    const populated = await withRefs(LiveClass.findById(liveClass._id));
    return res.status(200).json({ message: "Class ended", liveClass: serialize(populated) });
  } catch (error) {
    console.error("End live class error:", error);
    return res.status(500).json({ message: "Failed to end the class" });
  }
};

/* DELETE ------------------------------------------------------------ */
export const deleteLiveClass = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;

    if (liveClass.recording?.fileKey) await deleteFromS3(liveClass.recording.fileKey);
    await LiveClassParticipation.deleteMany({ liveClass: liveClass._id });
    await liveClass.deleteOne();

    return res.status(200).json({ message: "Live class deleted" });
  } catch (error) {
    console.error("Delete live class error:", error);
    return res.status(500).json({ message: "Failed to delete live class" });
  }
};

/* LECTURER JOIN (moderator) ----------------------------------------- */
export const joinAsLecturer = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;
    if (liveClass.status === "ended")
      return res.status(400).json({ message: "This class has ended" });

    const info = await getStaffInfo([req.user.userId]);
    const me = info.get(String(req.user.userId)) || { name: "Lecturer", email: "" };

    return res.status(200).json({
      join: buildJoinInfo({
        roomName: liveClass.roomName,
        userId: req.user.userId,
        name: me.name,
        email: me.email,
        moderator: true,
      }),
    });
  } catch (error) {
    console.error("Lecturer join error:", error);
    return res.status(500).json({ message: "Failed to open the classroom" });
  }
};

/* RECORDING: get a presigned URL so the browser uploads straight to S3 */
export const createRecordingUploadUrl = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;
    if (liveClass.status === "scheduled")
      return res.status(400).json({ message: "Start the class before uploading a recording" });

    const { fileName, mimeType, size } = req.body;
    if (!mimeType || !/^(video|audio)\//.test(mimeType))
      return res.status(400).json({ message: "Recording must be a video or audio file" });
    if (size && Number(size) > MAX_RECORDING_BYTES)
      return res.status(400).json({ message: "Recording is too large (5 GB maximum)" });

    // replacing a recording is deliberate: remove the old file first
    if (liveClass.recording?.fileKey) await deleteFromS3(liveClass.recording.fileKey);

    const ext = (mimeType.split("/")[1] || "webm").split(";")[0];
    const fileKey = `live-recordings/${liveClass._id}-${Date.now()}.${ext}`;
    const uploadUrl = await getUploadUrl(fileKey, mimeType);

    liveClass.recording = {
      status: "uploading",
      fileKey,
      fileName: fileName || `${liveClass.title}.${ext}`,
      mimeType,
      source: "browser",
    };
    await liveClass.save();

    return res.status(200).json({ uploadUrl, fileKey, contentType: mimeType });
  } catch (error) {
    console.error("Recording upload URL error:", error);
    return res.status(500).json({ message: "Failed to prepare the upload" });
  }
};

/* RECORDING: browser says the upload finished; we verify it in S3 */
export const completeRecordingUpload = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;
    if (liveClass.recording?.status !== "uploading" || !liveClass.recording.fileKey)
      return res.status(400).json({ message: "No recording upload in progress" });

    const head = await headObject(liveClass.recording.fileKey);
    if (!head) {
      liveClass.recording.status = "failed";
      await liveClass.save();
      return res.status(400).json({ message: "The recording file was not found. Please upload again." });
    }

    liveClass.recording.status = "ready";
    liveClass.recording.size = head.ContentLength;
    liveClass.recording.durationSeconds = Number(req.body.durationSeconds) || undefined;
    liveClass.recording.uploadedAt = new Date();
    await liveClass.save();

    const populated = await withRefs(LiveClass.findById(liveClass._id));
    return res.status(200).json({ message: "Recording saved", liveClass: serialize(populated) });
  } catch (error) {
    console.error("Complete recording error:", error);
    return res.status(500).json({ message: "Failed to save the recording" });
  }
};

export const deleteRecording = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;
    if (liveClass.recording?.fileKey) await deleteFromS3(liveClass.recording.fileKey);
    liveClass.recording = { status: "none" };
    await liveClass.save();
    return res.status(200).json({ message: "Recording removed" });
  } catch (error) {
    console.error("Delete recording error:", error);
    return res.status(500).json({ message: "Failed to remove the recording" });
  }
};

/* RECORDING: server-side recorders (Jibri finalize script, provider webhook relay)
   Authenticated with a shared secret instead of a user token.
   POST /api/live/recording/ingest  header: x-ingest-secret
   body: { roomName, fileKey, fileName?, mimeType?, size?, durationSeconds? }  */
export const ingestRecording = async (req, res) => {
  try {
    const secret = process.env.RECORDING_INGEST_SECRET || "";
    const given = String(req.headers["x-ingest-secret"] || "");
    const ok =
      secret.length > 0 &&
      given.length === secret.length &&
      crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
    if (!ok) return res.status(401).json({ message: "Unauthorized" });

    const { roomName, fileKey, fileName, mimeType, size, durationSeconds } = req.body;
    if (!roomName || !fileKey)
      return res.status(400).json({ message: "roomName and fileKey are required" });

    const liveClass = await LiveClass.findOne({ roomName });
    if (!liveClass) return res.status(404).json({ message: "Live class not found" });

    const head = await headObject(fileKey);
    if (!head) return res.status(400).json({ message: "File not found in storage" });

    if (liveClass.recording?.fileKey && liveClass.recording.fileKey !== fileKey)
      await deleteFromS3(liveClass.recording.fileKey);

    liveClass.recording = {
      status: "ready",
      fileKey,
      fileName: fileName || `${liveClass.title}.mp4`,
      mimeType: mimeType || "video/mp4",
      size: head.ContentLength || Number(size) || undefined,
      durationSeconds: Number(durationSeconds) || undefined,
      source: "server",
      uploadedAt: new Date(),
    };
    await liveClass.save();
    return res.status(200).json({ message: "Recording attached" });
  } catch (error) {
    console.error("Ingest recording error:", error);
    return res.status(500).json({ message: "Failed to attach the recording" });
  }
};

/* ATTENDANCE + REPLAY VIEWING (who came, who missed, who rewatched) -- */
export const getAttendance = async (req, res) => {
  try {
    const liveClass = await loadManaged(req, res);
    if (!liveClass) return;

    const studentIds = await getEnrolledStudentIds(liveClass.course);
    const parts = await LiveClassParticipation.find({ liveClass: liveClass._id });
    const partMap = new Map(parts.map((p) => [String(p.student), p]));
    const info = await getStudentInfo(studentIds);

    const rows = studentIds.map((id) => {
      const p = partMap.get(id);
      const dur = p?.replay?.durationSeconds || 0;
      return {
        studentId: id,
        student: info.get(id) || { name: "Unknown student", matric: "" },
        joinedLive: Boolean(p?.joinedLive),
        firstJoinedAt: p?.firstJoinedAt,
        joinCount: p?.joinCount || 0,
        watchedReplay: Boolean(p?.replay?.lastWatchedAt),
        replayCompleted: Boolean(p?.replay?.completed),
        replayPercent: dur ? Math.min(100, Math.round(((p.replay.positionSeconds || 0) / dur) * 100)) : 0,
        lastWatchedAt: p?.replay?.lastWatchedAt,
      };
    });

    rows.sort((a, b) => a.student.name.localeCompare(b.student.name));
    return res.status(200).json({
      liveClass: { _id: liveClass._id, title: liveClass.title, status: liveClass.status },
      totals: {
        enrolled: rows.length,
        attended: rows.filter((r) => r.joinedLive).length,
        missed: rows.filter((r) => !r.joinedLive).length,
        watchedReplay: rows.filter((r) => r.watchedReplay).length,
      },
      students: rows,
    });
  } catch (error) {
    console.error("Attendance error:", error);
    return res.status(500).json({ message: "Failed to load attendance" });
  }
};
