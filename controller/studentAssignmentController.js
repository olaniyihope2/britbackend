import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import { uploadToS3, deleteFromS3, getDownloadUrl } from "../utils/s3.js";

/* ------------------------------------------------------------------ */
/* !! ADAPT THIS ONE FUNCTION to however students are linked to courses !!
   It must return the ObjectIds of the courses the logged-in student is
   registered for. Below assumes a CourseRegistration model with
   { student, course }. Use the same lookup your course-materials
   student routes use.                                                  */
/* ------------------------------------------------------------------ */
import CourseRegistration from "../models/CourseRegistration.js";

const getEnrolledCourseIds = async (userId) => {
  const regs = await CourseRegistration.find({
    student: userId,
    status: "Registered",
  }).select("courses");

  // flatten every registration's courses array, dropping duplicates
  const ids = regs.flatMap((r) => r.courses || []).map(String);
  return [...new Set(ids)];
};

const FOLDER = "assignment-submissions";
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const isPastDue = (a) => a.dueDate && a.dueDate.getTime() < Date.now();

const lecturerName = (u) =>
  u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.name || u.username || "" : "";

const studentStatus = (a, sub) => {
  if (sub?.status === "Graded") return "Graded";
  if (sub) return "Submitted";
  if (a.status === "closed") return "Closed";
  if (isPastDue(a)) return "Overdue";
  return "Available";
};

// Shape sent to the student UI. Never exposes S3 keys.
const shape = (a, sub) => ({
  _id: a._id,
  title: a.title,
  description: a.description,
  lecturer: lecturerName(a.createdBy),
  course: a.course,
  maxMarks: a.maxMarks,
  dueDate: a.dueDate,
  createdAt: a.createdAt,
  hasAttachment: Boolean(a.attachment?.fileKey),
  canSubmit: a.status === "published" && !isPastDue(a) && sub?.status !== "Graded",
  studentStatus: studentStatus(a, sub),
  submission: sub
    ? {
        status: sub.status,
        text: sub.text,
        fileName: sub.attachment?.fileName,
        submittedAt: sub.submittedAt,
        // only reveal marks once graded
        score: sub.status === "Graded" ? sub.score : undefined,
        feedback: sub.status === "Graded" ? sub.feedback : undefined,
      }
    : null,
});

const populateAssignment = (q) =>
  q.populate("course", "code title").populate("createdBy", "firstName lastName name username");

// Loads a visible assignment the student is enrolled for; sends the error itself.
const loadForStudent = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ message: "Invalid assignment ID" });
    return null;
  }
  const assignment = await populateAssignment(Assignment.findById(req.params.id));
  if (!assignment || assignment.status === "draft") {
    res.status(404).json({ message: "Assignment not found" });
    return null;
  }
  const courseIds = (await getEnrolledCourseIds(req.user.userId)).map(String);
  if (!courseIds.includes(String(assignment.course?._id || assignment.course))) {
    res.status(403).json({ message: "You are not registered for this course" });
    return null;
  }
  return assignment;
};

/* LIST ------------------------------------------------------------- */
export const getStudentAssignments = async (req, res) => {
  try {
    const courseIds = await getEnrolledCourseIds(req.user.userId);
const regs = await CourseRegistration.find({ student: req.user.userId }).lean();
console.log(JSON.stringify(regs, null, 2));
    const assignments = await populateAssignment(
      Assignment.find({ course: { $in: courseIds }, status: { $in: ["published", "closed"] } }).sort({
        createdAt: -1,
      })
    );

    const subs = await AssignmentSubmission.find({
      student: req.user.userId,
      assignment: { $in: assignments.map((a) => a._id) },
    });
    const subMap = new Map(subs.map((s) => [String(s.assignment), s]));

    return res.status(200).json({
      assignments: assignments.map((a) => shape(a, subMap.get(String(a._id)))),
    });
  } catch (error) {
    console.error("Student assignments error:", error);
    return res.status(500).json({ message: "Failed to load assignments" });
  }
};

/* SUBMIT / RESUBMIT ------------------------------------------------- */
export const submitAssignment = async (req, res) => {
  try {
    const assignment = await loadForStudent(req, res);
    if (!assignment) return;

    let sub = await AssignmentSubmission.findOne({
      assignment: assignment._id,
      student: req.user.userId,
    });

    if (assignment.status !== "published")
      return res.status(400).json({ message: "This assignment is closed" });
    if (isPastDue(assignment))
      return res.status(400).json({ message: "The deadline for this assignment has passed" });
    if (sub?.status === "Graded")
      return res.status(400).json({ message: "This submission has already been graded" });

    const text = (req.body.text || "").trim();
    if (!text && !req.file && !sub?.attachment?.fileKey)
      return res.status(400).json({ message: "Add an answer or attach a file" });

    let oldKey = null;
    if (!sub) sub = new AssignmentSubmission({ assignment: assignment._id, student: req.user.userId });

    sub.text = text;
    sub.submittedAt = new Date();
    if (req.file) {
      oldKey = sub.attachment?.fileKey || null;
      sub.attachment = {
        fileName: req.file.originalname,
        fileKey: await uploadToS3(req.file, FOLDER),
        mimeType: req.file.mimetype,
        size: req.file.size,
      };
    }

    await sub.save();
    if (oldKey) await deleteFromS3(oldKey);

    return res.status(200).json({ message: "Assignment submitted", assignment: shape(assignment, sub) });
  } catch (error) {
    console.error("Submit assignment error:", error);
    return res.status(500).json({ message: error.message || "Failed to submit assignment" });
  }
};

/* LECTURER FILE DOWNLOAD (presigned URL) ----------------------------- */
export const downloadStudentAttachment = async (req, res) => {
  try {
    const assignment = await loadForStudent(req, res);
    if (!assignment) return;
    if (!assignment.attachment?.fileKey)
      return res.status(404).json({ message: "This assignment has no attachment" });

    const url = await getDownloadUrl(assignment.attachment.fileKey, assignment.attachment.fileName);
    return res.status(200).json({ url });
  } catch (error) {
    console.error("Student attachment error:", error);
    return res.status(500).json({ message: "Failed to get download link" });
  }
};