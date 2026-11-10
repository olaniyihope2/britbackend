import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import { flagAdmin } from "../middleware/requireAdmin.js";
import {
  createQuiz,
  getQuizzesByAllocation,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  getMyQuizzes,
  setQuizStatus,
  getAvailableQuizzesForStudent
} from "../controller/quizController.js";

const router = express.Router();

router.post("/", authenticateUser, flagAdmin, createQuiz);
router.get("/allocation/:allocationId", authenticateUser, flagAdmin, getQuizzesByAllocation);
// Must come before "/:id", or "my" is treated as a quiz ID
router.get("/my", authenticateUser, flagAdmin, getMyQuizzes);
router.get("/available", authenticateUser, getAvailableQuizzesForStudent);

router.get("/:id", authenticateUser, flagAdmin, getQuiz);
router.put("/:id", authenticateUser, flagAdmin, updateQuiz);
router.patch("/:id/status", authenticateUser, flagAdmin, setQuizStatus);
router.delete("/:id", authenticateUser, flagAdmin, deleteQuiz);

export default router;