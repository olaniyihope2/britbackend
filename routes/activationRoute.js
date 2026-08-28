import express from "express";
import { activateWithPin } from "../controller/activationController.js";

const router = express.Router();

// POST /api/user/activate
router.post("/user/activate", activateWithPin);

export default router;
