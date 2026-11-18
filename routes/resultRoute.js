import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import { flagAdmin } from "../middleware/requireAdmin.js";
import {
  getMyResults,
  getAllocationResults,
  saveScores,
  submitResults,
  getReviewSummary,
  approveResults,
  returnResults,
  publishResults,
  unpublishResults,
  getMyPublishedResults,
  getStudentStatement,
  getAdminDepartments,
  getDepartmentStudents,
  getMyStatement
} from "../controller/resultController.js";

const router = express.Router();

// flagAdmin only sets req.isAdmin. This check is what actually blocks non-admins.
const requireAdmin = (req, res, next) =>
  req.isAdmin ? next() : res.status(403).json({ message: "Only the administrator can do this." });

// Student
router.get("/my", authenticateUser, getMyResults);
router.get("/my-published", authenticateUser, getMyPublishedResults);

// Lecturer (own course) and admin
router.get("/allocation/:allocationId", authenticateUser, flagAdmin, getAllocationResults);
router.put("/allocation/:allocationId/scores", authenticateUser, flagAdmin, saveScores);
router.post("/allocation/:allocationId/submit", authenticateUser, flagAdmin, submitResults);

// Admin only
router.get("/review", authenticateUser, flagAdmin, requireAdmin, getReviewSummary);
// Admin only
router.get("/admin/departments", authenticateUser, flagAdmin, requireAdmin, getAdminDepartments);
router.get("/my-statement", authenticateUser, getMyStatement);
router.get("/admin/students", authenticateUser, flagAdmin, requireAdmin, getDepartmentStudents);
router.get("/admin/student-statement", authenticateUser, flagAdmin, requireAdmin, getStudentStatement);
router.post("/allocation/:allocationId/approve", authenticateUser, flagAdmin, requireAdmin, approveResults);
router.post("/allocation/:allocationId/return", authenticateUser, flagAdmin, requireAdmin, returnResults);
router.post("/allocation/:allocationId/publish", authenticateUser, flagAdmin, requireAdmin, publishResults);
router.post("/allocation/:allocationId/unpublish", authenticateUser, flagAdmin, requireAdmin, unpublishResults);

export default router;