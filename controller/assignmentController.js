import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import CourseAllocation from "../models/CourseAllocation.js";
import { uploadToS3, deleteFromS3, getDownloadUrl } from "../utils/s3.js";

const FOLDER = "assignments";
const STATUSES = ["draft", "published", "closed"];
const PAST_DUE_MESSAGE =
  "The due date has already passed. Choose a later date before publishing.";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// The lecturer the course is allocated to (or an admin) may manage its assignments
const canManage = (allocation, req) =>
  req.isAdmin || String(allocation.staff) === String(req.user.userId);

const parseDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseMarks = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const withRefs = (query) =>
  query
    .populate("course", "code title")
    .populate("programme", "name code")
    .populate("academicSession", "name");

// Never expose the S3 key to the browser
const serialize = (doc) => {
  const o = doc.toObject();
  const a = o.attachment;
  o.hasAttachment = Boolean(a?.fileKey);
  if (o.hasAttachment) {
    o.attachment = { fileName: a.fileName, mimeType: a.mimeType, size: a.size };
  } else {
    delete o.attachment;
  }
  return o;
};

// Loads an assignment the caller may manage. Sends the error response itself
// and returns null when it can't.
const loadManaged = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ message: "Invalid assignment ID" });
    return null;
  }
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) {
    res.status(404).json({ message: "Assignment not found" });
    return null;
  }
  const allocation = await CourseAllocation.findById(assignment.allocation);
  if (!allocation || !canManage(allocation, req)) {
    res.status(403).json({ message: "Not allowed" });
    return null;
  }
  return { assignment, allocation };
};

/* ------------------------------------------------------------------ */
/* LIST (the lecturer's own assignments + their active courses)        */
/* ------------------------------------------------------------------ */
export const getMyAssignments = async (req, res) => {
  try {
    const { allocationId } = req.query;
    let allocationIds;

    if (allocationId) {
      if (!isValidId(allocationId))
        return res.status(400).json({ message: "Invalid allocation ID" });
      const allocation = await CourseAllocation.findById(allocationId);
      if (!allocation)
        return res.status(404).json({ message: "Course allocation not found" });
      if (!canManage(allocation, req))
        return res.status(403).json({ message: "This course is not assigned to you" });
      allocationIds = [allocation._id];
    } else {
      const mine = await CourseAllocation.find({ staff: req.user.userId }).select("_id");
      allocationIds = mine.map((a) => a._id);
    }

    const assignments = await withRefs(
      Assignment.find({ allocation: { $in: allocationIds } }).sort({ createdAt: -1 })
    );

    // Active courses, used by the frontend for the course dropdown/filter
    const allocations = await CourseAllocation.find({
      staff: req.user.userId,
      status: "Active",
    })
      .populate("course", "code title credits")
      .populate("programme", "name code")
      .populate("academicSession", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      assignments: assignments.map(serialize),
      allocations,
    });
  } catch (error) {
    console.error("Get assignments error:", error);
    return res.status(500).json({ message: "Failed to load assignments" });
  }
};

/* ------------------------------------------------------------------ */
/* CREATE                                                              */
/* ------------------------------------------------------------------ */
export const createAssignment = async (req, res) => {
  try {
    const { allocationId, title, description, dueDate, maxMarks, status } = req.body;

    if (!isValidId(allocationId))
      return res.status(400).json({ message: "Select a course" });

    const allocation = await CourseAllocation.findById(allocationId);
    if (!allocation)
      return res.status(404).json({ message: "Course allocation not found" });
    if (!canManage(allocation, req))
      return res.status(403).json({ message: "This course is not assigned to you" });
    if (allocation.status !== "Active" && !req.isAdmin)
      return res.status(400).json({ message: "This course allocation is not active" });

    if (!title?.trim())
      return res.status(400).json({ message: "Title is required" });

    const due = parseDate(dueDate);
    if (!due) return res.status(400).json({ message: "A valid due date is required" });

    const marks = parseMarks(maxMarks);
    if (!marks)
      return res.status(400).json({ message: "Maximum marks must be greater than 0" });

    const finalStatus = STATUSES.includes(status) ? status : "draft";
    if (finalStatus === "published" && due.getTime() < Date.now())
      return res.status(400).json({ message: PAST_DUE_MESSAGE });

    // Validate first, upload last, so failed requests leave no orphan files
    let attachment;
    if (req.file) {
      attachment = {
        fileName: req.file.originalname,
        fileKey: await uploadToS3(req.file, FOLDER),
        mimeType: req.file.mimetype,
        size: req.file.size,
      };
    }

    const assignment = await Assignment.create({
      allocation: allocation._id,
      course: allocation.course,
      programme: allocation.programme,
      academicSession: allocation.academicSession,
      level: allocation.level,
      semester: allocation.semester,
      createdBy: req.user.userId,
      title: title.trim(),
      description: description?.trim() || "",
      dueDate: due,
      maxMarks: marks,
      status: finalStatus,
      attachment,
    });

    const populated = await withRefs(Assignment.findById(assignment._id));
    return res
      .status(201)
      .json({ message: "Assignment created", assignment: serialize(populated) });
  } catch (error) {
    console.error("Create assignment error:", error);
    return res.status(500).json({ message: error.message || "Failed to create assignment" });
  }
};

/* ------------------------------------------------------------------ */
/* UPDATE (details, optionally replace or remove the attachment)       */
/* ------------------------------------------------------------------ */
export const updateAssignment = async (req, res) => {
  try {
    const found = await loadManaged(req, res);
    if (!found) return;
    const { assignment } = found;

    const { title, description, dueDate, maxMarks, status, removeAttachment } = req.body;
    const previousStatus = assignment.status;

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "Title cannot be empty" });
      assignment.title = title.trim();
    }
    if (description !== undefined) assignment.description = description.trim();
    if (dueDate !== undefined) {
      const due = parseDate(dueDate);
      if (!due) return res.status(400).json({ message: "A valid due date is required" });
      assignment.dueDate = due;
    }
    if (maxMarks !== undefined) {
      const marks = parseMarks(maxMarks);
      if (!marks)
        return res.status(400).json({ message: "Maximum marks must be greater than 0" });
      assignment.maxMarks = marks;
    }
    if (status !== undefined) {
      if (!STATUSES.includes(status))
        return res.status(400).json({ message: "Invalid status" });
      assignment.status = status;
    }

    if (
      assignment.status === "published" &&
      previousStatus !== "published" &&
      assignment.dueDate.getTime() < Date.now()
    )
      return res.status(400).json({ message: PAST_DUE_MESSAGE });

    let oldKey = null;
    if (req.file) {
      oldKey = assignment.attachment?.fileKey || null;
      assignment.attachment = {
        fileName: req.file.originalname,
        fileKey: await uploadToS3(req.file, FOLDER),
        mimeType: req.file.mimetype,
        size: req.file.size,
      };
    } else if (removeAttachment === "true" && assignment.attachment?.fileKey) {
      oldKey = assignment.attachment.fileKey;
      assignment.attachment = undefined;
    }

    await assignment.save();
    if (oldKey) await deleteFromS3(oldKey); // only after the save succeeds

    const populated = await withRefs(Assignment.findById(assignment._id));
    return res
      .status(200)
      .json({ message: "Assignment updated", assignment: serialize(populated) });
  } catch (error) {
    console.error("Update assignment error:", error);
    return res.status(500).json({ message: error.message || "Failed to update assignment" });
  }
};

/* ------------------------------------------------------------------ */
/* PUBLISH / CLOSE / REOPEN                                            */
/* ------------------------------------------------------------------ */
export const setAssignmentStatus = async (req, res) => {
  try {
    const found = await loadManaged(req, res);
    if (!found) return;
    const { assignment } = found;

    const { status } = req.body;
    if (!STATUSES.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    if (status === "published" && assignment.dueDate.getTime() < Date.now())
      return res.status(400).json({ message: PAST_DUE_MESSAGE });

    assignment.status = status;
    await assignment.save();

    const populated = await withRefs(Assignment.findById(assignment._id));
    return res
      .status(200)
      .json({ message: `Assignment ${status}`, assignment: serialize(populated) });
  } catch (error) {
    console.error("Set assignment status error:", error);
    return res.status(500).json({ message: "Failed to update status" });
  }
};

/* ------------------------------------------------------------------ */
/* DELETE                                                              */
/* ------------------------------------------------------------------ */
export const deleteAssignment = async (req, res) => {
  try {
    const found = await loadManaged(req, res);
    if (!found) return;
    const { assignment } = found;

    if (assignment.attachment?.fileKey) await deleteFromS3(assignment.attachment.fileKey);
    await assignment.deleteOne();

    return res.status(200).json({ message: "Assignment deleted" });
  } catch (error) {
    console.error("Delete assignment error:", error);
    return res.status(500).json({ message: "Failed to delete assignment" });
  }
};

/* ------------------------------------------------------------------ */
/* ATTACHMENT DOWNLOAD (presigned URL)                                 */
/* ------------------------------------------------------------------ */
export const downloadAttachment = async (req, res) => {
  try {
    const found = await loadManaged(req, res);
    if (!found) return;
    const { assignment } = found;

    if (!assignment.attachment?.fileKey)
      return res.status(404).json({ message: "This assignment has no attachment" });

    const url = await getDownloadUrl(
      assignment.attachment.fileKey,
      assignment.attachment.fileName
    );
    return res.status(200).json({ url });
  } catch (error) {
    console.error("Assignment attachment error:", error);
    return res.status(500).json({ message: "Failed to get download link" });
  }
};