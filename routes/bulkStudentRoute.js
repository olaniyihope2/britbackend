import express from "express";
import multer from "multer";
import authenticateUser from "../middleware/authMiddleware.js";
import { bulkUploadStudents } from "../controller/bulkStudentController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/bulk-upload/students", authenticateUser, upload.single("file"), bulkUploadStudents);

export default router;
