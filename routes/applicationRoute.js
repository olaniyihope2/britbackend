import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import {
  getMyApplications,
  getApplicationById,
  getAllApplications,
  reviewApplication,
  markApplicationFeePaid,
  markAcceptanceFeePaid,
} from "../controller/applicationController.js";

const router = express.Router();

// student-facing
router.get("/applications/mine", authenticateUser, getMyApplications);
router.get("/applications/:id", authenticateUser, getApplicationById);

// admin-facing (add role-check middleware here once you have one, e.g. requireAdmin)
router.get("/applications", authenticateUser, getAllApplications);
router.patch("/applications/:id/review", authenticateUser, reviewApplication);
router.patch("/applications/:id/pay-application-fee", authenticateUser, markApplicationFeePaid);
router.patch("/applications/:id/pay-acceptance-fee", authenticateUser, markAcceptanceFeePaid);

export default router;