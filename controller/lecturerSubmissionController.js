import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import CourseAllocation from "../models/CourseAllocation.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import { getDownloadUrl } from "../utils/s3.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const canManage = (allocation, req) =>
  req.isAdmin || String(allocation.staff) === String(req.user.userId);

// Loads the assignment if the caller manages it; sends the error itself otherwise.
const loadManaged = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ message: "Invalid assignment ID" });
    return null;
  }
  const assignment = await Assignment.findById(req.params.id).populate("course", "code title");
  if (!assignment) {
    res.status(404).json({ message: "Assignment not found" });
    return null;
  }
  const allocation = await CourseAllocation.findById(assignment.allocation);
  if (!allocation || !canManage(allocation, req)) {
    res.status(403).json({ message: "Not allowed" });
    return null;
  }
  return assignment;
};

/* ------------------------------------------------------------------ */
/* !! ADAPT: how to get a student's display name / matric number !!
   Uses whichever model is registered as "Student" (or "User").
   Adjust the field names to match your student schema.               */
/* ------------------------------------------------------------------ */
const getStudentInfo = async (ids) => {
  const Model = mongoose.models.Student || mongoose.models.User;
  if (!Model) return new Map();
  const students = await Model.find({ _id: { $in: ids } }).lean();
  return new Map(
    students.map((s) => [
      String(s._id),
      {
        name:
          `${s.firstName || ""} ${s.lastName || ""}`.trim() || s.name || s.username || "Unknown student",
        matric: s.matricNumber || s.matricNo || s.regNumber || s.registrationNumber || "",
      },
    ])
  );
};

/* LIST SUBMISSIONS ------------------------------------------------- */
export const getSubmissions = async (req, res) => {
  try {
    const assignment = await loadManaged(req, res);
    if (!assignment) return;

    const subs = await AssignmentSubmission.find({ assignment: assignment._id }).sort({
      submittedAt: -1,
    });
    const info = await getStudentInfo(subs.map((s) => s.student));

    return res.status(200).json({
      assignment: {
        _id: assignment._id,
        title: assignment.title,
        course: assignment.course,
        maxMarks: assignment.maxMarks,
        dueDate: assignment.dueDate,
        status: assignment.status,
      },
      submissions: subs.map((s) => ({
        _id: s._id,
        student: info.get(String(s.student)) || { name: "Unknown student", matric: "" },
        text: s.text,
        fileName: s.attachment?.fileName || "",
        hasFile: Boolean(s.attachment?.fileKey),
        fileSize: s.attachment?.size,
        status: s.status,
        score: s.score,
        feedback: s.feedback,
        submittedAt: s.submittedAt,
        late: assignment.dueDate ? s.submittedAt > assignment.dueDate : false,
      })),
    });
  } catch (error) {
    console.error("Get submissions error:", error);
    return res.status(500).json({ message: "Failed to load submissions" });
  }
};

/* DOWNLOAD A STUDENT'S FILE (presigned URL) ------------------------- */
export const downloadSubmissionFile = async (req, res) => {
  try {
    const assignment = await loadManaged(req, res);
    if (!assignment) return;
    if (!isValidId(req.params.submissionId))
      return res.status(400).json({ message: "Invalid submission ID" });

    const sub = await AssignmentSubmission.findOne({
      _id: req.params.submissionId,
      assignment: assignment._id,
    });
    if (!sub?.attachment?.fileKey)
      return res.status(404).json({ message: "This submission has no file" });

    const url = await getDownloadUrl(sub.attachment.fileKey, sub.attachment.fileName);
    return res.status(200).json({ url });
  } catch (error) {
    console.error("Submission file error:", error);
    return res.status(500).json({ message: "Failed to get download link" });
  }
};

/* GRADE ------------------------------------------------------------- */
export const gradeSubmission = async (req, res) => {
  try {
    const assignment = await loadManaged(req, res);
    if (!assignment) return;
    if (!isValidId(req.params.submissionId))
      return res.status(400).json({ message: "Invalid submission ID" });

    const score = Number(req.body.score);
    if (!Number.isFinite(score) || score < 0 || score > assignment.maxMarks)
      return res
        .status(400)
        .json({ message: `Score must be between 0 and ${assignment.maxMarks}` });

    const sub = await AssignmentSubmission.findOne({
      _id: req.params.submissionId,
      assignment: assignment._id,
    });
    if (!sub) return res.status(404).json({ message: "Submission not found" });

    sub.score = score;
    sub.feedback = (req.body.feedback || "").trim();
    sub.status = "Graded";
    await sub.save();

    return res.status(200).json({
      message: "Submission graded",
      submission: { _id: sub._id, status: sub.status, score: sub.score, feedback: sub.feedback },
    });
  } catch (error) {
    console.error("Grade submission error:", error);
    return res.status(500).json({ message: "Failed to save grade" });
  }
};