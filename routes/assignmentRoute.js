import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import { flagAdmin } from "../middleware/requireAdmin.js";
import { uploadAssignmentFile } from "../middleware/uploadAssignment.js";
import {
  getMyAssignments,
  createAssignment,
  updateAssignment,
  setAssignmentStatus,
  deleteAssignment,
  downloadAttachment,
} from "../controller/assignmentController.js";

const router = express.Router();

router.get("/mine", authenticateUser, flagAdmin, getMyAssignments);
router.post("/", authenticateUser, flagAdmin, uploadAssignmentFile, createAssignment);
router.get("/:id/attachment", authenticateUser, flagAdmin, downloadAttachment);
router.put("/:id", authenticateUser, flagAdmin, uploadAssignmentFile, updateAssignment);
router.patch("/:id/status", authenticateUser, flagAdmin, setAssignmentStatus);
router.delete("/:id", authenticateUser, flagAdmin, deleteAssignment);

export default router;