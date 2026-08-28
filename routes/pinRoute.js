import express from "express";
import { generatePins } from "../controller/pinController.js";
// import authenticateUser from "../middleware/authMiddleware.js"; // optional

const router = express.Router();

// POST /api/pins/generate
router.post("/pins/generate", /* authenticateUser, */ generatePins);

export default router;
