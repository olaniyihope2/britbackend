// examRoutes.js
import express from "express";

import authenticateUser from "../middleware/authMiddleware.js";
import { getQuestionsForSubject, getSubjects, getSubjectTopics } from "../controller/jambsubjectController.js";
const router = express.Router();



// Retrieve questions for a specific exam
router.get("/subject", getSubjects);
router.get("/subject/:subject/topics", getSubjectTopics);
router.get("/subject/:subject/questions", getQuestionsForSubject);
export default router;
