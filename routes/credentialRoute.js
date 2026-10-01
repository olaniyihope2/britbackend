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

const router = express.Router();

// student
router.post("/credentials", authenticateUser, uploadCredentialFile, uploadCredential);
router.get("/credentials/mine", authenticateUser, getMyCredentials);
router.put("/credentials/:id/resubmit", authenticateUser, uploadCredentialFile, resubmitCredential);
router.delete("/credentials/:id", authenticateUser, deleteCredential);

// shared (owner or admin)
router.get("/credentials/:id/download", authenticateUser,  downloadCredential);

// admin
router.get("/credentials", authenticateUser,  getAllCredentials);
router.patch("/credentials/:id/verify", authenticateUser,  verifyCredential);

export default router;