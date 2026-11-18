import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import { flagAdmin } from "../middleware/requireAdmin.js";
import {
  getResultsOverview,
  getAllocationResults,
  approveAllocationResults,
  returnAllocationResults,
  publishAllocationResults,
} from "../controller/resultReviewController.js";

const router = express.Router();

router.get("/admin/overview", authenticateUser, flagAdmin, getResultsOverview);
router.get("/admin/allocation/:allocationId", authenticateUser, flagAdmin, getAllocationResults);
router.post("/admin/allocation/:allocationId/approve", authenticateUser, flagAdmin, approveAllocationResults);
router.post("/admin/allocation/:allocationId/return", authenticateUser, flagAdmin, returnAllocationResults);
router.post("/admin/allocation/:allocationId/publish", authenticateUser, flagAdmin, publishAllocationResults);

export default router;