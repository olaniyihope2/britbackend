// // controller/studentCourseController.js
// import Course from "../models/Course.js";
// import User from "../models/userModel.js";
// import Session from "../models/sessionModel.js";
// import CourseRegistration from "../models/CourseRegistration.js";

// /* =====================================================
//    SETTINGS - change these to suit the school
// ===================================================== */

// // Fee is worked out from credit units because Course has no fee field.
// const FEE_PER_UNIT = Number(process.env.FEE_PER_UNIT) || 5000;

// // false = registering saves the courses as "Registered" straight away.
// // true  = it saves as "Pending Payment" and the student goes on to pay.
// const REQUIRE_PAYMENT = false;

// // Used when your Session record has no semester field.
// const DEFAULT_SEMESTER = "First Semester";

// /* =====================================================
//    HELPERS
// ===================================================== */

// class HttpError extends Error {
//   constructor(status, message) {
//     super(message);
//     this.status = status;
//   }
// }

// // "ND1" -> "ND 1" (the Course model uses the spaced version)
// const normaliseLevel = (level) =>
//   level
//     ? String(level)
//         .trim()
//         .replace(/^(ND|HND)\s*(\d)$/i, (_, p, n) => `${p.toUpperCase()} ${n}`)
//     : null;

// const normaliseSemester = (value) => {
//   if (!value) return null;
//   const v = String(value).toLowerCase();
//   if (v.includes("first") || v.includes("1")) return "First Semester";
//   if (v.includes("second") || v.includes("2")) return "Second Semester";
//   return null;
// };

// const formatCourse = (course) => ({
//   id: course._id,
//   code: course.code,
//   title: course.title,
//   unit: course.credits,
//   fee: course.credits * FEE_PER_UNIT,
//   type: course.type,
// });

// // req.user is set by your protect middleware: { id, userId, role }
// const getStudent = async (req) => {
//   const id = req.user?.id;

//   if (!id) {
//     throw new HttpError(401, "You are not logged in");
//   }

//   const student = await User.findById(id).populate("programme", "name");

//   if (!student || student.role !== "student") {
//     throw new HttpError(403, "Only students can register for courses");
//   }

//   if (!student.programme) {
//     throw new HttpError(
//       400,
//       "Your programme has not been set. Please contact the admin office."
//     );
//   }

//   const level = normaliseLevel(student.level);

//   if (!level) {
//     throw new HttpError(
//       400,
//       "Your level has not been set. Please contact the admin office."
//     );
//   }

//   return { student, level };
// };

// // Uses the student's own session first, then falls back to a current/newest one.
// const getSession = async (student) => {
//   const ids = Array.isArray(student.session) ? student.session : [];

//   let session = ids.length ? await Session.findById(ids[ids.length - 1]) : null;

//   if (!session) {
//     session =
//       (await Session.findOne({ isCurrent: true })) ||
//       (await Session.findOne().sort({ createdAt: -1 }));
//   }

//   if (!session) {
//     throw new HttpError(400, "No academic session has been set up yet.");
//   }

//   const name =
//     [
//       session.name,
//       session.sessionName,
//       session.title,
//       session.academicYear,
//       session.session,
//     ].find((v) => typeof v === "string" && v.trim()) || String(session._id);

//   const semester =
//     normaliseSemester(session.currentSemester || session.semester) ||
//     DEFAULT_SEMESTER;

//   return { name, semester };
// };

// const formatRegistration = (registration) =>
//   registration && {
//     status: registration.status,
//     totalUnits: registration.totalUnits,
//     totalAmount: registration.totalAmount,
//     createdAt: registration.createdAt,
//     courses: (registration.courses || []).map(formatCourse),
//   };

// /* =====================================================
//    GET COURSES + EXISTING REGISTRATION
//    GET /api/student/courses/registration
// ===================================================== */

// export const getRegistrationCourses = async (req, res) => {
//   try {
//     const { student, level } = await getStudent(req);
//     const session = await getSession(student);

//     const courses = await Course.find({
//       programme: student.programme._id,
//       level,
//       semester: session.semester,
//       status: "Approved",
//     }).sort({ type: 1, code: 1 }); // Compulsory first

//     const registration = await CourseRegistration.findOne({
//       student: student._id,
//       session: session.name,
//       semester: session.semester,
//     }).populate("courses");

//     res.status(200).json({
//       success: true,
//       student: {
//         name: student.studentName || student.username,
//         programme: student.programme.name,
//         level,
//       },
//       session: session.name,
//       semester: session.semester,
//       courses: courses.map(formatCourse),
//       registration: formatRegistration(registration),
//     });
//   } catch (error) {
//     console.error("REGISTRATION ERROR:", error);
//     res.status(error.status || 500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// /* =====================================================
//    REGISTER THE SELECTED COURSES
//    POST /api/student/courses/registration
//    body: { courseIds: ["...", "..."] }
// ===================================================== */

// export const submitRegistration = async (req, res) => {
//   try {
//     const { courseIds } = req.body;

//     if (!Array.isArray(courseIds) || courseIds.length === 0) {
//       throw new HttpError(400, "Select at least one course");
//     }

//     const { student, level } = await getStudent(req);
//     const session = await getSession(student);

//     const filter = {
//       student: student._id,
//       session: session.name,
//       semester: session.semester,
//     };

//     const existing = await CourseRegistration.findOne(filter);

//     if (existing && existing.status === "Registered") {
//       throw new HttpError(
//         400,
//         "You have already registered for this semester"
//       );
//     }

//     // Re-check every course on the server. Never trust the browser.
//     const uniqueIds = [...new Set(courseIds)];

//     const courses = await Course.find({
//       _id: { $in: uniqueIds },
//       programme: student.programme._id,
//       level,
//       semester: session.semester,
//       status: "Approved",
//     });

//     if (courses.length !== uniqueIds.length) {
//       throw new HttpError(
//         400,
//         "One or more selected courses are not available to you"
//       );
//     }

//     // Totals are calculated here, not taken from the browser
//     const totalUnits = courses.reduce((sum, c) => sum + c.credits, 0);
//     const totalAmount = totalUnits * FEE_PER_UNIT;

//     const registration = await CourseRegistration.findOneAndUpdate(
//       filter,
//       {
//         programme: student.programme._id,
//         level,
//         courses: courses.map((c) => c._id),
//         totalUnits,
//         totalAmount,
//         status: REQUIRE_PAYMENT ? "Pending Payment" : "Registered",
//       },
//       { new: true, upsert: true, setDefaultsOnInsert: true }
//     );

//     res.status(200).json({
//       success: true,
//       message: REQUIRE_PAYMENT
//         ? "Course selection saved. Proceed to payment."
//         : "Courses registered successfully.",
//       registration: { status: registration.status },
//     });
//   } catch (error) {
//     console.error("REGISTRATION ERROR:", error);
//     res.status(error.status || 500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };
// controller/StudentCourseController.js
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

    const courses = await Course.find({
      programme: student.programme._id,
      level,
      semester: session.semester,
      status: "Approved",
    }).sort({ type: 1, code: 1 }); // Compulsory first

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
        programme: student.programme.name,
        level,
      },
      session: session.name,
      semester: session.semester,
      courses: courses.map(formatCourse),
      registration: formatRegistration(registration),
      fees,
    });
  } catch (error) {
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

    const courses = await Course.find({
      _id: { $in: uniqueIds },
      programme: student.programme._id,
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
        programme: student.programme._id,
        level,
        courses: courses.map((c) => c._id),
        totalUnits,
        status: "Registered",
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Courses registered successfully.",
      registration: { status: registration.status },
    });
  } catch (error) {
    sendError(res, error);
  }
};