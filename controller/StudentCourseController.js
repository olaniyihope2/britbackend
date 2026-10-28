import Course from "../models/Course.js";
import CourseRegistration from "../models/CourseRegistration.js";
import {
  HttpError,
  getStudent,
  getSession,
  sendError,
} from "../utils/studentContext.js";
import { getFeeStatus } from "../services/feeService.js";
import { reconcilePendingPayments } from "../services/paystackService.js";

const formatCourse = (course) => ({
  id: course._id,
  code: course.code,
  title: course.title,
  unit: course.credits,
  type: course.type,
});

const formatRegistration = (registration) =>
  registration && {
    status: registration.status,
    totalUnits: registration.totalUnits,
    createdAt: registration.createdAt,
    courses: (registration.courses || []).map(formatCourse),
  };

/* =====================================================
   GET COURSES, EXISTING REGISTRATION AND FEE STATUS
   GET /api/student/courses/registration
===================================================== */

export const getRegistrationCourses = async (req, res) => {
  try {
    const { student, level } = await getStudent(req, { requireAcademic: true });
    const session = await getSession(student);

    // ✅ FIXED: Changed from student.programme._id to student.department._id
    if (!student.department) {
      throw new HttpError(400, "Your department has not been set. Please contact the admin office.");
    }

    console.log("🔍 [getRegistrationCourses] Student department:", student.department);
    console.log("🔍 [getRegistrationCourses] Level:", level);
    console.log("🔍 [getRegistrationCourses] Semester:", session.semester);

    const courses = await Course.find({
      department: student.department._id,  // ✅ CHANGED: programme → department
      level,
      semester: session.semester,
      status: "Approved",
    }).sort({ type: 1, code: 1 }); // Compulsory first

    console.log("✅ [getRegistrationCourses] Found courses:", courses.length);

    const registration = await CourseRegistration.findOne({
      student: student._id,
      session: session.name,
      semester: session.semester,
    }).populate("courses");

    await reconcilePendingPayments(student._id);
    const fees = await getFeeStatus(student, session);

    res.status(200).json({
      success: true,
      student: {
        name: student.studentName || student.username,
        department: student.department.name,  // ✅ CHANGED: programme → department
        level,
      },
      session: session.name,
      semester: session.semester,
      courses: courses.map(formatCourse),
      registration: formatRegistration(registration),
      fees,
    });
  } catch (error) {
    console.error("❌ [getRegistrationCourses] ERROR:", error.message);
    sendError(res, error);
  }
};

/* =====================================================
   REGISTER THE SELECTED COURSES (only if fees are paid)
   POST /api/student/courses/registration
   body: { courseIds: ["...", "..."] }
===================================================== */

export const submitRegistration = async (req, res) => {
  try {
    const { courseIds } = req.body;

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      throw new HttpError(400, "Select at least one course");
    }

    const { student, level } = await getStudent(req, { requireAcademic: true });
    const session = await getSession(student);

    // ✅ Check for department
    if (!student.department) {
      throw new HttpError(400, "Your department has not been set. Please contact the admin office.");
    }

    // The fee check happens here on the server, so it can't be skipped
    await reconcilePendingPayments(student._id);
    const fees = await getFeeStatus(student, session);

    if (!fees.eligible) {
      throw new HttpError(
        403,
        "Please pay all required fees before registering your courses."
      );
    }

    const filter = {
      student: student._id,
      session: session.name,
      semester: session.semester,
    };

    const existing = await CourseRegistration.findOne(filter);

    if (existing && existing.status === "Registered") {
      throw new HttpError(
        400,
        "You have already registered for this semester"
      );
    }

    // Re-check every course on the server. Never trust the browser.
    const uniqueIds = [...new Set(courseIds)];

    // ✅ FIXED: Changed from student.programme._id to student.department._id
    const courses = await Course.find({
      _id: { $in: uniqueIds },
      department: student.department._id,  // ✅ CHANGED: programme → department
      level,
      semester: session.semester,
      status: "Approved",
    });

    if (courses.length !== uniqueIds.length) {
      throw new HttpError(
        400,
        "One or more selected courses are not available to you"
      );
    }

    const totalUnits = courses.reduce((sum, c) => sum + c.credits, 0);

    const registration = await CourseRegistration.findOneAndUpdate(
      filter,
      {
        department: student.department._id,  // ✅ CHANGED: programme → department
        level,
        courses: courses.map((c) => c._id),
        totalUnits,
        status: "Registered",
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log("✅ [submitRegistration] Registration successful:", registration.status);

    res.status(200).json({
      success: true,
      message: "Courses registered successfully.",
      registration: { status: registration.status },
    });
  } catch (error) {
    console.error("❌ [submitRegistration] ERROR:", error.message);
    sendError(res, error);
  }
};