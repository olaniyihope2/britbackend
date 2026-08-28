import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import authenticateUser from "../middleware/authMiddleware.js";
import {
  askHomeworkAssistant,
  createHomeworkSubmission,
  getHomeworkSubmissions,
  gradeHomeworkSubmission,
} from "../controller/homeworkController.js";

const router = express.Router();
const uploadDir = path.join(process.cwd(), "uploads", "homework");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`),
});
const upload = multer({ storage });

router.post("/homework/assistant", authenticateUser, askHomeworkAssistant);
router.post("/homework/submissions", authenticateUser, upload.single("attachment"), createHomeworkSubmission);
router.get("/homework/submissions", authenticateUser, getHomeworkSubmissions);
router.patch("/homework/submissions/:id", authenticateUser, gradeHomeworkSubmission);

export default router;
