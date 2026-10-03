import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import { flagAdmin } from "../middleware/requireAdmin.js";
import { uploadMaterialFile } from "../middleware/uploadMaterial.js";
import {
  createMaterial,
  getMaterialsByAllocation,
  updateMaterial,
  deleteMaterial,
  downloadMaterial,
    getMaterialsForStudent,
  downloadMaterialForStudent,
} from "../controller/courseMaterialController.js";

const router = express.Router();

router.post("/", authenticateUser, flagAdmin, uploadMaterialFile, createMaterial);
router.get("/allocation/:allocationId", authenticateUser, flagAdmin, getMaterialsByAllocation);
router.get("/:id/download", authenticateUser, flagAdmin, downloadMaterial);
router.get("/course/:courseId", authenticateUser, getMaterialsForStudent);
router.get("/student/:id/download", authenticateUser, downloadMaterialForStudent);
router.put("/:id", authenticateUser, flagAdmin, uploadMaterialFile, updateMaterial);
router.delete("/:id", authenticateUser, flagAdmin, deleteMaterial);

export default router;