
import express from "express";
import {
  initializePayment,
  verifyPayment,
  paystackWebhook,
  checkAccess,
} from "../controller/schPaymentController.js";
import { protect } from "../middleware/protectUser.js";
const router = express.Router();


router.post(
  "/sch/webhook",
  express.raw({ type: "application/json" }),
  paystackWebhook
);


router.get("/sch/access", checkAccess);


router.get("/sch/verify/:reference", verifyPayment);

router.post("/sch-initialize", protect, initializePayment);

export default router;
