// routes/feePaymentRoutes.js
import express from "express";

import {
  getPaymentStatus,
  initializePayment,
  verifyPayment,
} from "../controller/feePaymentController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/status", protect, getPaymentStatus);

router.post("/initialize", protect, initializePayment);

router.get("/verify/:reference", protect, verifyPayment);

export default router;

/*
  In server.js (see the reply for exact placement):

  import feePaymentRoutes from "./routes/feePaymentRoutes.js";
  import { paystackWebhook } from "./controller/feePaymentController.js";

  // BEFORE app.use(express.json(...)):
  app.post(
    "/api/fee-payments/webhook",
    express.raw({ type: "application/json" }),
    paystackWebhook
  );

  // with your other routes:
  app.use("/api/fee-payments", feePaymentRoutes);
*/
