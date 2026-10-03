import express from "express";
import authenticateUser from "../middleware/authMiddleware.js";
import { uploadCredentialFile } from "../middleware/uploadCredential.js";
import {
  uploadCredential,
  getMyCredentials,
  resubmitCredential,
  deleteCredential,
  getAllCredentials,
  verifyCredential,
  downloadCredential,
} from "../controller/credentialController.js";
import { requireAdmin, flagAdmin } from "../middleware/requireAdmin.js";

const router = express.Router();

// student
router.post("/credentials", authenticateUser, uploadCredentialFile, uploadCredential);
router.get("/credentials/mine", authenticateUser, getMyCredentials);
router.put("/credentials/:id/resubmit", authenticateUser, uploadCredentialFile, resubmitCredential);
router.delete("/credentials/:id", authenticateUser, deleteCredential);


// shared (owner or admin)
router.get("/credentials/:id/download", authenticateUser, flagAdmin, downloadCredential);

// admin
router.get("/credentials", authenticateUser, requireAdmin, getAllCredentials);
router.patch("/credentials/:id/verify", authenticateUser, requireAdmin, verifyCredential);
export default router;