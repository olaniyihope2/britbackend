import express from "express";
import {
  initializeSubscription,
  verifySubscription,
  subscriptionWebhook,
  checkSubscription,
} from "../controller/subscriptionController.js";
import { protect } from "../middleware/protectUser.js";

const router = express.Router();

// Webhook must use raw body — no auth middleware
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  subscriptionWebhook
);

router.get("/status", protect, checkSubscription);
router.get("/verify/:reference", protect, verifySubscription);
router.post("/initialize", protect, initializeSubscription);

export default router;