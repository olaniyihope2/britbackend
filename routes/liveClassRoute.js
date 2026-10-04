import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import { flagAdmin } from "../middleware/requireAdmin.js";
import {
  getMyLiveClasses,
  createLiveClass,
  updateLiveClass,
  startLiveClass,
  endLiveClass,
  deleteLiveClass,
  joinAsLecturer,
  createRecordingUploadUrl,
  completeRecordingUpload,
  deleteRecording,
  ingestRecording,
  getAttendance,
} from "../controller/liveClassController.js";
import {
  getStudentLiveClasses,
  joinLiveClass,
  getReplay,
  saveReplayProgress,
} from "../controller/studentLiveClassController.js";

const router = express.Router();

/* Server-to-server (shared secret, no user token) */
router.post("/recording/ingest", ingestRecording);

/* Student routes (declared before "/:id" so "student" is never read as an id) */
router.get("/student/list", authenticateUser, getStudentLiveClasses);
router.post("/student/:id/join", authenticateUser, joinLiveClass);
router.get("/student/:id/replay", authenticateUser, getReplay);
router.post("/student/:id/progress", authenticateUser, saveReplayProgress);

/* Lecturer / admin routes */
router.get("/mine", authenticateUser, flagAdmin, getMyLiveClasses);
router.post("/", authenticateUser, flagAdmin, createLiveClass);
router.put("/:id", authenticateUser, flagAdmin, updateLiveClass);
router.delete("/:id", authenticateUser, flagAdmin, deleteLiveClass);
router.post("/:id/start", authenticateUser, flagAdmin, startLiveClass);
router.post("/:id/end", authenticateUser, flagAdmin, endLiveClass);
router.post("/:id/join", authenticateUser, flagAdmin, joinAsLecturer);
router.get("/:id/attendance", authenticateUser, flagAdmin, getAttendance);
router.post("/:id/recording/upload-url", authenticateUser, flagAdmin, createRecordingUploadUrl);
router.post("/:id/recording/complete", authenticateUser, flagAdmin, completeRecordingUpload);
router.delete("/:id/recording", authenticateUser, flagAdmin, deleteRecording);

export default router;
