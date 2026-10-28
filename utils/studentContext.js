// utils/studentContext.js
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";

// Used when your Session record has no semester field.
export const DEFAULT_SEMESTER = "First Semester";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const sendError = (res, error) => {
  console.error("ERROR:", error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message,
  });
};

// "ND1" -> "ND 1" (the Course model uses the spaced version)
export const normaliseLevel = (level) =>
  level
    ? String(level)
        .trim()
        .replace(/^(ND|HND)\s*(\d)$/i, (_, p, n) => `${p.toUpperCase()} ${n}`)
    : null;

export const normaliseSemester = (value) => {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v.includes("first") || v.includes("1")) return "First Semester";
  if (v.includes("second") || v.includes("2")) return "Second Semester";
  return null;
};

/*
  Finds the logged-in student. req.user comes from your protect middleware.
  requireAcademic = true also demands a department and level (needed for
  course registration, not for paying fees).
*/
export const getStudent = async (req, { requireAcademic = false } = {}) => {
  const id = req.user?.id;

  if (!id) {
    throw new HttpError(401, "You are not logged in");
  }

  // ✅ FIXED: Changed from "programme" to "department"
  const student = await User.findById(id).populate("department", "name");

  if (!student || student.role !== "student") {
    throw new HttpError(403, "Only students can do this");
  }

  const level = normaliseLevel(student.level);

  if (requireAcademic) {
    // ✅ FIXED: Changed from student.programme to student.department
    if (!student.department) {
      throw new HttpError(
        400,
        "Your department has not been set. Please contact the admin office."
      );
    }

    if (!level) {
      throw new HttpError(
        400,
        "Your level has not been set. Please contact the admin office."
      );
    }
  }

  console.log("✅ [getStudent] Student loaded successfully");
  console.log("   - Name:", student.studentName || student.username);
  console.log("   - Department:", student.department?.name || "Not set");
  console.log("   - Level:", level);

  return { student, level };
};

// Uses the student's own session first, then a current/newest one.
export const getSession = async (student) => {
  const ids = Array.isArray(student.session) ? student.session : [];

  let session = ids.length ? await Session.findById(ids[ids.length - 1]) : null;

  if (!session) {
    session =
      (await Session.findOne({ isCurrent: true })) ||
      (await Session.findOne().sort({ createdAt: -1 }));
  }

  if (!session) {
    throw new HttpError(400, "No academic session has been set up yet.");
  }

  const name =
    [
      session.name,
      session.sessionName,
      session.title,
      session.academicYear,
      session.session,
    ].find((v) => typeof v === "string" && v.trim()) || String(session._id);

  const semester =
    normaliseSemester(session.currentSemester || session.semester) ||
    DEFAULT_SEMESTER;

  console.log("✅ [getSession] Session loaded");
  console.log("   - Session:", name);
  console.log("   - Semester:", semester);

  return { name, semester };
};