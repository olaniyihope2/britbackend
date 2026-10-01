import mongoose from "mongoose";
import Credential from "../models/credentialModel.js";
import Application from "../models/applicationModel.js";
import { uploadToS3, deleteFromS3, getDownloadUrl } from "../utils/s3.js";

const EDITABLE = ["Pending Verification", "Issue Found", "Rejected"];

/* ------------------------------------------------------------------ */
/* STUDENT                                                             */
/* ------------------------------------------------------------------ */

// Upload a credential for one of the student's applications
export const uploadCredential = async (req, res) => {
  try {
    const { applicationId, credentialType, examYear, examNumber } = req.body;

    if (!req.file) return res.status(400).json({ error: "File is required" });
    if (!mongoose.Types.ObjectId.isValid(applicationId))
      return res.status(400).json({ error: "Invalid application ID" });

    const application = await Application.findOne({
      _id: applicationId,
      user: req.user.userId,
    });
    if (!application)
      return res.status(404).json({ error: "Application not found" });

    if (["Approved", "Rejected"].includes(application.status))
      return res.status(400).json({ error: "This application is already closed" });

    // Validate first, upload last, so failed requests leave no orphan files
    const fileKey = await uploadToS3(req.file);

    const credential = await Credential.create({
      application: application._id,
      user: req.user.userId,
      credentialType,
      examYear,
      examNumber,
      fileName: req.file.originalname,
      fileKey,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    return res.status(201).json({ credential });
  } catch (error) {
    console.error("Error uploading credential:", error);
    return res.status(500).json({ error: "Failed to upload credential" });
  }
};

// List the student's own credentials (optionally for one application)
export const getMyCredentials = async (req, res) => {
  try {
    const filter = { user: req.user.userId };

    if (req.query.applicationId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.applicationId))
        return res.status(400).json({ error: "Invalid application ID" });
      filter.application = req.query.applicationId;
    }

    const credentials = await Credential.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ credentials });
  } catch (error) {
    console.error("Error fetching credentials:", error);
    return res.status(500).json({ error: "Failed to get credentials" });
  }
};

// Replace the file after "Issue Found" / "Rejected"
export const resubmitCredential = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File is required" });

    const credential = await Credential.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });
    if (!credential)
      return res.status(404).json({ error: "Credential not found" });

    if (!EDITABLE.includes(credential.status))
      return res.status(400).json({ error: "A verified credential cannot be replaced" });

    const oldKey = credential.fileKey;
    const newKey = await uploadToS3(req.file);

    Object.assign(credential, {
      fileName: req.file.originalname,
      fileKey: newKey,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      examYear: req.body.examYear ?? credential.examYear,
      examNumber: req.body.examNumber ?? credential.examNumber,
      status: "Pending Verification",
      remark: undefined,
      verifiedBy: undefined,
      verifiedAt: undefined,
    });
    await credential.save();

    await deleteFromS3(oldKey); // remove the old file only after the save succeeds

    return res.status(200).json({ credential });
  } catch (error) {
    console.error("Error resubmitting credential:", error);
    return res.status(500).json({ error: "Failed to resubmit credential" });
  }
};

// Delete an unverified credential
export const deleteCredential = async (req, res) => {
  try {
    const credential = await Credential.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });
    if (!credential)
      return res.status(404).json({ error: "Credential not found" });

    if (credential.status === "Verified")
      return res.status(400).json({ error: "A verified credential cannot be deleted" });

    await deleteFromS3(credential.fileKey);
    await credential.deleteOne();

    return res.status(200).json({ message: "Credential deleted" });
  } catch (error) {
    console.error("Error deleting credential:", error);
    return res.status(500).json({ error: "Failed to delete credential" });
  }
};

/* ------------------------------------------------------------------ */
/* ADMIN                                                               */
/* ------------------------------------------------------------------ */

// List all credentials (filter by status or application)
export const getAllCredentials = async (req, res) => {
  try {
    const { status, applicationId } = req.query;
    const filter = {};

    if (status) {
      if (!["Pending Verification", "Verified", "Rejected", "Issue Found"].includes(status))
        return res.status(400).json({ error: "Invalid status" });
      filter.status = status;
    }

    if (applicationId) {
      if (!mongoose.Types.ObjectId.isValid(applicationId))
        return res.status(400).json({ error: "Invalid application ID" });
      filter.application = applicationId;
    }

    const credentials = await Credential.find(filter)
      .populate("user", "username studentName email")
      .populate({
        path: "application",
        select: "applicationNumber programme session",
        populate: { path: "programme", select: "name code" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({ credentials });
  } catch (error) {
    console.error("Error fetching credentials:", error);
    return res.status(500).json({ error: "Failed to get credentials" });
  }
};

// Verify / reject / flag a credential
export const verifyCredential = async (req, res) => {
  try {
    const { status, remark } = req.body;

    if (!["Verified", "Rejected", "Issue Found"].includes(status))
      return res.status(400).json({ error: "Invalid status" });

    if (status !== "Verified" && !remark?.trim())
      return res
        .status(400)
        .json({ error: "A remark is required so the student knows what to fix" });

    const credential = await Credential.findByIdAndUpdate(
      req.params.id,
      {
        status,
        remark: status === "Verified" ? undefined : remark,
        verifiedBy: req.user.userId,
        verifiedAt: new Date(),
      },
      { new: true }
    );
    if (!credential)
      return res.status(404).json({ error: "Credential not found" });

    return res.status(200).json({ credential });
  } catch (error) {
    console.error("Error verifying credential:", error);
    return res.status(500).json({ error: "Failed to verify credential" });
  }
};

/* ------------------------------------------------------------------ */
/* SHARED (owner or admin)                                             */
/* ------------------------------------------------------------------ */

// Returns a short-lived presigned S3 URL
export const downloadCredential = async (req, res) => {
  try {
    const credential = await Credential.findById(req.params.id);
    if (!credential)
      return res.status(404).json({ error: "Credential not found" });

    const isOwner = String(credential.user) === String(req.user.userId);
    if (!isOwner && !req.isAdmin)
      return res.status(403).json({ error: "Not allowed" });

    const url = await getDownloadUrl(credential.fileKey, credential.fileName);
    return res.status(200).json({ url });
  } catch (error) {
    console.error("Error downloading credential:", error);
    return res.status(500).json({ error: "Failed to download credential" });
  }
};