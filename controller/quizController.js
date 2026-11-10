import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import CourseAllocation from "../models/CourseAllocation.js";
import Session from "../models/sessionModel.js";
import CourseRegistration from "../models/CourseRegistration.js";
import { getStudent, getSession, sendError } from "../utils/studentContext.js";
const QUESTION_TYPES = ["multiple-choice", "true-false", "short-answer"];
import User from "../models/userModel.js";
import Course from "../models/Course.js";
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const canManage = (allocation, req) =>
  req.isAdmin || String(allocation.staff) === String(req.user.userId);
// The quiz's creator, an admin, or the currently assigned lecturer may manage it
const canManageQuiz = (quiz, allocation, req) =>
  req.isAdmin ||
  String(quiz.createdBy) === String(req.user.userId) ||
  (allocation && String(allocation.staff) === String(req.user.userId));
const normalizeSemester = (value) => {
  const v = String(value || "").toLowerCase();
  if (v.startsWith("first")) return "First";
  if (v.startsWith("second")) return "Second";
  return null;
};


/* ------------------------------------------------------------------ */
/* VALIDATION HELPERS                                                  */
/* ------------------------------------------------------------------ */

// Validates and normalises the questions array sent by the frontend
const buildQuestions = (input) => {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "Add at least one question." };
  }

  const questions = [];

  for (let i = 0; i < input.length; i++) {
    const q = input[i] || {};
    const n = i + 1;
    const type = q.type;
    const text = String(q.question ?? "").trim();
    const marks = Number(q.marks);
    const correctAnswer = String(q.correctAnswer ?? "").trim();

    if (!QUESTION_TYPES.includes(type)) {
      return { error: `Question ${n} has an invalid type.` };
    }
    if (!text) {
      return { error: `Question ${n} cannot be empty.` };
    }
    if (!Number.isFinite(marks) || marks <= 0) {
      return { error: `Question ${n} must have marks greater than 0.` };
    }

    let options = [];

    if (type === "multiple-choice") {
      options = (Array.isArray(q.options) ? q.options : []).map((o) => ({
        text: String(o?.text ?? "").trim(),
      }));

      if (options.length < 2) {
        return { error: `Question ${n} needs at least 2 options.` };
      }
      if (options.some((o) => !o.text)) {
        return { error: `Complete all options in question ${n}.` };
      }
      if (!options.some((o) => o.text === correctAnswer)) {
        return { error: `The correct answer for question ${n} must match one of its options.` };
      }
    } else if (type === "true-false") {
      if (!["True", "False"].includes(correctAnswer)) {
        return { error: `Select True or False as the answer for question ${n}.` };
      }
    } else if (!correctAnswer) {
      return { error: `Enter the expected answer for question ${n}.` };
    }

    questions.push({
      questionNumber: n,
      type,
      question: text,
      marks,
      options,
      correctAnswer,
    });
  }

  return { questions };
};

// Validates the quiz fields shared by create and update
const parseQuizFields = (body) => {
  const title = String(body.title ?? "").trim();
  if (!title) return { error: "Enter a quiz title." };

  const type = body.type || "Test";
  if (!["Test", "Exam"].includes(type)) {
    return { error: "Type must be Test or Exam." };
  }

  const duration = Number(body.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: "Enter a valid duration in minutes." };
  }

  const passMark = body.passMark === undefined || body.passMark === "" ? 50 : Number(body.passMark);
  if (!Number.isFinite(passMark) || passMark < 0 || passMark > 100) {
    return { error: "Pass mark must be between 0 and 100." };
  }

  const startDate = body.startDate ? new Date(body.startDate) : null;
  const endDate = body.endDate ? new Date(body.endDate) : null;
  if ((startDate && isNaN(startDate)) || (endDate && isNaN(endDate))) {
    return { error: "Start or end date is invalid." };
  }
  if (startDate && endDate && endDate <= startDate) {
    return { error: "End date must be after the start date." };
  }

  const status = body.status === "published" ? "published" : "draft";

  const built = buildQuestions(body.questions);
  if (built.error) return { error: built.error };

  const totalMarks = built.questions.reduce((sum, q) => sum + q.marks, 0);

  return {
    data: {
      title,
      instructions: String(body.instructions ?? "").trim(),
      type,
      duration,
      passMark,
      startDate,
      endDate,
      status,
      questions: built.questions,
      totalMarks,
    },
  };
};

// Reads the current semester from the allocation's session (server is the source of truth)
const resolveCurrentSemester = async (allocation) => {
  const session = await Session.findById(allocation.academicSession).select(
    "name currentSemester"
  );

  if (!session) {
    return { error: "The academic session for this course was not found." };
  }

  const semester = normalizeSemester(session.currentSemester);

  if (!semester) {
    return {
      error: "The current semester is not set for this session. Ask the admin to set it.",
    };
  }

  const allocationSemester = normalizeSemester(allocation.semester);

  if (allocationSemester !== semester) {
    return {
      error: `This course is allocated for the ${allocation.semester}, but the current semester is ${semester}.`,
    };
  }

  return { session, semester };
};
/* ------------------------------------------------------------------ */
/* CREATE                                                              */
/* ------------------------------------------------------------------ */
export const createQuiz = async (req, res) => {
  try {
    const { allocationId } = req.body;

    if (!isValidId(allocationId)) {
      return res.status(400).json({ message: "Invalid course allocation ID." });
    }

    const allocation = await CourseAllocation.findById(allocationId);
    if (!allocation) {
      return res.status(404).json({ message: "Course allocation not found." });
    }
    if (!canManage(allocation, req)) {
      return res.status(403).json({ message: "This course is not assigned to you." });
    }
    if (allocation.status !== "Active") {
      return res.status(400).json({ message: "This course allocation is not active." });
    }

    const parsed = parseQuizFields(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const semesterCheck = await resolveCurrentSemester(allocation);
    if (semesterCheck.error) {
      return res.status(400).json({ message: semesterCheck.error });
    }

    const quiz = await Quiz.create({
      ...parsed.data,
      allocation: allocation._id,
      course: allocation.course,
      academicSession: allocation.academicSession,
      semester: semesterCheck.semester,
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      message: quiz.status === "published" ? "Quiz published." : "Quiz saved as draft.",
      quiz,
    });
  } catch (error) {
    console.error("Create quiz error:", error);
    return res.status(500).json({ message: "Failed to create quiz." });
  }
};

/* ------------------------------------------------------------------ */
/* LIST (by allocation, current semester only by default)              */
/* ------------------------------------------------------------------ */
export const getQuizzesByAllocation = async (req, res) => {
  try {
    const { allocationId } = req.params;

    if (!isValidId(allocationId)) {
      return res.status(400).json({ message: "Invalid course allocation ID." });
    }

    const allocation = await CourseAllocation.findById(allocationId);
    if (!allocation) {
      return res.status(404).json({ message: "Course allocation not found." });
    }
    if (!canManage(allocation, req)) {
      return res.status(403).json({ message: "This course is not assigned to you." });
    }

    // Optional ?semester=First|Second. Defaults to the allocation's semester.
    const semester = ["First", "Second"].includes(req.query.semester)
      ? req.query.semester
      : allocation.semester;

    const quizzes = await Quiz.find({ allocation: allocation._id, semester })
      .select("-questions")
      .sort({ createdAt: -1 });

    return res.status(200).json({ quizzes, semester });
  } catch (error) {
    console.error("List quizzes error:", error);
    return res.status(500).json({ message: "Failed to load quizzes." });
  }
};

/* ------------------------------------------------------------------ */
/* GET ONE (full quiz, including answers, for the lecturer)            */
/* ------------------------------------------------------------------ */
export const getQuiz = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quiz ID." });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found." });

    const allocation = await CourseAllocation.findById(quiz.allocation);
    if (!allocation || !canManage(allocation, req)) {
      return res.status(403).json({ message: "Not allowed." });
    }

    return res.status(200).json({ quiz });
  } catch (error) {
    console.error("Get quiz error:", error);
    return res.status(500).json({ message: "Failed to load quiz." });
  }
};

/* ------------------------------------------------------------------ */
/* UPDATE                                                              */
/* ------------------------------------------------------------------ */
export const updateQuiz = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quiz ID." });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found." });

    const allocation = await CourseAllocation.findById(quiz.allocation);
    if (!allocation || !canManage(allocation, req)) {
      return res.status(403).json({ message: "Not allowed." });
    }

    // Keep published quizzes locked so students don't see changes mid-quiz.
    // Unpublish first (status: "draft") to edit.
    if (quiz.status === "published" && req.body.status !== "draft") {
      return res.status(400).json({
        message: "Unpublish this quiz before editing it.",
      });
    }

    const parsed = parseQuizFields(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    // Semester and session are fixed when the quiz is created
    Object.assign(quiz, parsed.data);
    await quiz.save();

    return res.status(200).json({ message: "Quiz updated.", quiz });
  } catch (error) {
    console.error("Update quiz error:", error);
    return res.status(500).json({ message: "Failed to update quiz." });
  }
};

/* ------------------------------------------------------------------ */
/* DELETE (drafts only)                                                */
/* ------------------------------------------------------------------ */
export const deleteQuiz = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quiz ID." });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found." });

 const allocation = await CourseAllocation.findById(quiz.allocation);
if (!canManageQuiz(quiz, allocation, req)) {
  return res.status(403).json({ message: "Not allowed." });
}

    if (quiz.status === "published") {
      return res.status(400).json({
        message: "Unpublish the quiz before deleting it.",
      });
    }

    await quiz.deleteOne();

    return res.status(200).json({ message: "Quiz deleted." });
  } catch (error) {
    console.error("Delete quiz error:", error);
    return res.status(500).json({ message: "Failed to delete quiz." });
  }
};
/* ------------------------------------------------------------------ */
/* LIST MY QUIZZES (for the Manage Quiz page)                          */
/* ------------------------------------------------------------------ */
export const getMyQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ createdBy: req.user.userId })
      .populate("course", "code title")
      .sort({ createdAt: -1 })
      .lean();

    const shaped = quizzes.map(({ questions = [], ...quiz }) => ({
      ...quiz,
      questionCount: questions.length,
    }));

    return res.status(200).json({ quizzes: shaped });
  } catch (error) {
    console.error("Get my quizzes error:", error);
    return res.status(500).json({ message: "Failed to load your quizzes." });
  }
};

export const setQuizStatus = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid quiz ID." });
    const { status } = req.body;
    if (!["draft", "published"].includes(status))
      return res.status(400).json({ message: "Invalid status." });

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found." });

    const allocation = await CourseAllocation.findById(quiz.allocation);
    if (!canManageQuiz(quiz, allocation, req))
      return res.status(403).json({ message: "Not allowed." });

    quiz.status = status;
    await quiz.save();
    return res.status(200).json({ message: `Quiz ${status === "draft" ? "unpublished" : "published"}.`, quiz });
  } catch (error) {
    console.error("Set quiz status error:", error);
    return res.status(500).json({ message: "Failed to update quiz status." });
  }
};
/* ------------------------------------------------------------------ */
/* STUDENT: published quizzes for the courses they registered          */
/* GET /quizzes/available                                              */
/* ------------------------------------------------------------------ */

export const getAvailableQuizzesForStudent = async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?.userId;
    const student = await User.findById(studentId).select("level department session");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const courses = await Course.find({
      level: student.level,
      department: student.department,
      status: "Approved",
    }).select("_id");

    const docs = await Quiz.find({
      course: { $in: courses.map((c) => c._id) },
      academicSession: { $in: student.session },
      status: "published",
    })
      .select("title type instructions duration passMark totalMarks startDate endDate course createdBy questions")
      .populate("course", "title code")
      .populate("createdBy", "studentName username")
      .sort({ startDate: -1 })
      .lean();

    // Students get the question count, never the questions or answers
    const quizzes = docs.map(({ questions = [], createdBy, ...quiz }) => ({
      ...quiz,
      questionCount: questions.length,
      totalMarks: quiz.totalMarks,
      creator: createdBy?.studentName || createdBy?.username || "Course Tutor",
    }));

    res.json({ quizzes, registered: true });
  } catch (err) {
    console.error("getAvailableQuizzesForStudent failed:", err);
    res.status(500).json({ message: "Could not load quizzes" });
  }
};
// export const getAvailableQuizzesForStudent = async (req, res) => {
//   try {
//     const { student } = await getStudent(req);
//     const session = await getSession(student);
//     const semester = normalizeSemester(session.semester);

//     const registration = await CourseRegistration.findOne({
//       student: student._id,
//       session: session.name,
//       semester: session.semester,
//       status: "Registered",
//     }).select("courses");

//     if (!semester || !registration || registration.courses.length === 0) {
//       return res.status(200).json({ quizzes: [], registered: false });
//     }

//     const docs = await Quiz.find({
//       course: { $in: registration.courses },
//       academicSession: session._id,
//       semester,
//       status: "published", // drafts never reach students
//     })
//       .select(
//         "title type instructions duration passMark totalMarks startDate endDate course createdBy questions"
//       )
//       .populate("course", "code title")
//       .populate("createdBy", "fullname username")
//       .sort({ startDate: -1, createdAt: -1 })
//       .lean();

//     // Questions and answers stay on the server; students only get the count
//     const quizzes = docs.map(({ questions = [], createdBy, ...quiz }) => ({
//       ...quiz,
//       questionCount: questions.length,
//       creator: createdBy?.fullname || createdBy?.username || "Course Tutor",
//     }));

//     return res.status(200).json({ quizzes, registered: true });
//   } catch (error) {
//     console.error("Available quizzes error:", error);
//     return sendError(res, error);
//   }
// };