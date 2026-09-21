// routes/paymentRoutes.js
import express from "express";

import {
  getPaymentStatus,
  initializePayment,
  verifyPayment,
} from "../controller/paymentController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/status", protect, getPaymentStatus);

router.post("/initialize", protect, initializePayment);

router.get("/verify/:reference", protect, verifyPayment);

export default router;

/*
  In server.js:

  import paymentRoutes from "./routes/paymentRoutes.js";
  import { paystackWebhook } from "./controller/paymentController.js";

  // The webhook needs the RAW body, so it goes BEFORE app.use(express.json()):
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    paystackWebhook
  );

  // ...then app.use(express.json()) as you already have...

  app.use("/api/payments", paymentRoutes);
*/
