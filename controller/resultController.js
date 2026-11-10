import mongoose from "mongoose";
import Result from "../models/Result.js";
import CourseAllocation from "../models/CourseAllocation.js";
import CourseRegistration from "../models/CourseRegistration.js";
import { CA_MAX, EXAM_MAX, computeGPA } from "../utils/grading.js";
import { normalizeSemester } from "../utils/semester.js";

const STUDENT_FIELDS = "firstName lastName username matricNumber";
const SEMESTER_MESSAGE =
  "This course is not in the current semester. Results can only be entered for the current semester.";

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const idOf = (ref) => ref?._id ?? ref;

const displayName = (u) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "Unknown";

const canManage = (allocation, req) =>
  req.isAdmin || String(allocation.staff) === String(req.user.userId);

// Same rule as assignments: the course's semester must match the session's current semester
const isCurrentSemester = (allocation) => {
  const sessionSemester = normalizeSemester(allocation.academicSession?.currentSemester);
  return (
    allocation.status === "Active" &&
    sessionSemester !== null &&
    normalizeSemester(allocation.semester) === sessionSemester
  );
};

const parseScore = (value, max) => {
  if (value === "" || value === null || value === undefined) return { value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    return { error: `Score must be between 0 and ${max}.` };
  }
  return { value: n };
};

// Loads the allocation and sends the error response if the caller can't see it
const loadAllocation = async (allocationId, req, res) => {
  if (!isValidId(allocationId)) {
    res.status(400).json({ message: "Invalid course allocation ID." });
    return null;
  }
  const allocation = await CourseAllocation.findById(allocationId)
    .populate("course", "code title credits")
    .populate("academicSession", "name currentSemester");

  if (!allocation) {
    res.status(404).json({ message: "Course allocation not found." });
    return null;
  }
  if (!canManage(allocation, req)) {
    res.status(403).json({ message: "This course is not assigned to you." });
    return null;
  }
  return allocation;
};

// Students registered for this course in this session and semester.
// Map of studentId -> student user document.
const getRegisteredStudents = async (allocation) => {
  const registrations = await CourseRegistration.find({
    status: "Registered",
    session: idOf(allocation.academicSession),
    semester: allocation.semester,
    "courses.course": idOf(allocation.course),
  }).populate("student", STUDENT_FIELDS);

  const map = new Map();
  for (const reg of registrations) {
    if (reg.student) map.set(String(reg.student._id), reg.student);
  }
  return map;
};

const rowShape = (r) => ({
  resultId: r._id,
  studentId: String(idOf(r.student)),
  name: displayName(r.student),
  matricNumber: r.student?.matricNumber || "",
  caScore: r.caScore,
  examScore: r.examScore,
  total: r.total,
  grade: r.grade,
  comment: r.comment,
  status: r.status,
});

/* ------------------------------------------------------------------ */
/* LECTURER: ROSTER (own course) OR ADMIN (any course)                 */
/* ------------------------------------------------------------------ */
export const getAllocationResults = async (req, res) => {
  try {
    const allocation = await loadAllocation(req.params.allocationId, req, res);
    if (!allocation) return;

    const [registered, rows] = await Promise.all([
      getRegisteredStudents(allocation),
      Result.find({ allocation: allocation._id }).populate("student", STUDENT_FIELDS),
    ]);

    const rowByStudent = new Map(rows.map((r) => [String(idOf(r.student)), r]));

    // Registered students with no row yet appear as "not_entered"
    const pending = [...registered.entries()]
      .filter(([sid]) => !rowByStudent.has(sid))
      .map(([sid, user]) => ({
        resultId: null,
        studentId: sid,
        name: displayName(user),
        matricNumber: user.matricNumber || "",
        caScore: null,
        examScore: null,
        total: null,
        grade: null,
        comment: "",
        status: "not_entered",
      }));

    const students = [...rows.map(rowShape), ...pending].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const summary = students.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      allocation: {
        id: allocation._id,
        course: allocation.course,
        semester: allocation.semester,
        session: allocation.academicSession?.name,
        level: allocation.level,
        editable: isCurrentSemester(allocation),
      },
      students,
      summary,
    });
  } catch (error) {
    console.error("Get allocation results error:", error);
    return res.status(500).json({ message: "Failed to load results." });
  }
};

/* ------------------------------------------------------------------ */
/* LECTURER: SAVE SCORES (drafts only, current semester only)          */
/* ------------------------------------------------------------------ */
export const saveScores = async (req, res) => {
  try {
    const allocation = await loadAllocation(req.params.allocationId, req, res);
    if (!allocation) return;

    if (!isCurrentSemester(allocation)) {
      return res.status(400).json({ message: SEMESTER_MESSAGE });
    }

    const { scores } = req.body;
    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ message: "No scores were sent." });
    }

    const [registered, existing] = await Promise.all([
      getRegisteredStudents(allocation),
      Result.find({ allocation: allocation._id }),
    ]);
    const rowByStudent = new Map(existing.map((r) => [String(r.student), r]));

    let saved = 0;
    const errors = [];

    for (const item of scores) {
      const sid = String(item?.studentId || "");

      if (!isValidId(sid)) {
        errors.push({ studentId: sid, message: "Invalid student." });
        continue;
      }
      if (!registered.has(sid) && !rowByStudent.has(sid)) {
        errors.push({ studentId: sid, message: "This student is not registered for the course." });
        continue;
      }

      const ca = parseScore(item.caScore, CA_MAX);
      const exam = parseScore(item.examScore, EXAM_MAX);
      const scoreError = ca.error || exam.error;
      if (scoreError) {
        errors.push({ studentId: sid, message: scoreError });
        continue;
      }

      let doc = rowByStudent.get(sid);
      if (doc && doc.status !== "draft") {
        errors.push({
          studentId: sid,
          message: `This result is ${doc.status} and can no longer be changed.`,
        });
        continue;
      }

      if (!doc) {
        doc = new Result({
          student: sid,
          allocation: allocation._id,
          course: idOf(allocation.course),
          academicSession: idOf(allocation.academicSession),
          semester: normalizeSemester(allocation.semester),
          level: allocation.level || "",
          creditUnits: allocation.course?.credits ?? 0,
        });
      }

      doc.caScore = ca.value;
      doc.examScore = exam.value;
      doc.comment = String(item.comment ?? "").trim();
      doc.enteredBy = req.user.userId;

      await doc.save();
      saved++;
    }

    return res.status(200).json({
      message: `${saved} result(s) saved as draft.`,
      saved,
      errors,
    });
  } catch (error) {
    console.error("Save scores error:", error);
    return res.status(500).json({ message: "Failed to save scores." });
  }
};

/* ------------------------------------------------------------------ */
/* LECTURER: SUBMIT TO ADMIN (every registered student must be complete)*/
/* ------------------------------------------------------------------ */
export const submitResults = async (req, res) => {
  try {
    const allocation = await loadAllocation(req.params.allocationId, req, res);
    if (!allocation) return;

    if (!isCurrentSemester(allocation)) {
      return res.status(400).json({ message: SEMESTER_MESSAGE });
    }

    const [registered, rows] = await Promise.all([
      getRegisteredStudents(allocation),
      Result.find({ allocation: allocation._id }).populate("student", STUDENT_FIELDS),
    ]);

    const rowByStudent = new Map(rows.map((r) => [String(idOf(r.student)), r]));
    const required = new Set([...registered.keys(), ...rowByStudent.keys()]);

    const incomplete = [];
    for (const sid of required) {
      const r = rowByStudent.get(sid);
      if (!r || r.caScore == null || r.examScore == null) {
        const user = registered.get(sid) || r?.student;
        incomplete.push(displayName(user));
      }
    }

    if (incomplete.length) {
      return res.status(400).json({
        message: `Enter CA and exam scores for ${incomplete.length} student(s) before submitting.`,
        incomplete,
      });
    }

    const drafts = rows.filter((r) => r.status === "draft");
    if (drafts.length === 0) {
      return res.status(400).json({ message: "There are no draft results to submit." });
    }

    await Result.updateMany(
      { allocation: allocation._id, status: "draft" },
      { $set: { status: "submitted", submittedAt: new Date() } }
    );

    return res.status(200).json({
      message: `${drafts.length} result(s) submitted for approval.`,
      submitted: drafts.length,
    });
  } catch (error) {
    console.error("Submit results error:", error);
    return res.status(500).json({ message: "Failed to submit results." });
  }
};

/* ------------------------------------------------------------------ */
/* ADMIN: REVIEW SUMMARY (per course, per session and semester)        */
/* ------------------------------------------------------------------ */
export const getReviewSummary = async (req, res) => {
  try {
    const match = {};
    if (req.query.session && isValidId(req.query.session)) {
      match.academicSession = new mongoose.Types.ObjectId(req.query.session);
    }
    const semester = normalizeSemester(req.query.semester);
    if (semester) match.semester = semester;

    const groups = await Result.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$allocation",
          all: { $sum: 1 },
          draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          submitted: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          published: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
        },
      },
    ]);

    const allocations = await CourseAllocation.find({
      _id: { $in: groups.map((g) => g._id) },
    })
      .populate("course", "code title credits")
      .populate("staff", "firstName lastName username")
      .populate("academicSession", "name");

    const byId = new Map(allocations.map((a) => [String(a._id), a]));

    const data = groups
      .map((g) => {
        const a = byId.get(String(g._id));
        return {
          allocationId: g._id,
          course: a?.course ? `${a.course.code} - ${a.course.title}` : "Unknown course",
          lecturer: displayName(a?.staff),
          session: a?.academicSession?.name || "",
          semester: a?.semester || "",
          level: a?.level || "",
          counts: { all: g.all, draft: g.draft, submitted: g.submitted, approved: g.approved, published: g.published },
        };
      })
      .sort((x, y) => x.course.localeCompare(y.course));

    return res.status(200).json({ allocations: data });
  } catch (error) {
    console.error("Review summary error:", error);
    return res.status(500).json({ message: "Failed to load review summary." });
  }
};

/* ------------------------------------------------------------------ */
/* ADMIN: STATUS TRANSITIONS                                           */
/* ------------------------------------------------------------------ */
const transition = (fromStatuses, toStatus, extraSet = () => ({})) => async (req, res) => {
  try {
    const allocation = await loadAllocation(req.params.allocationId, req, res);
    if (!allocation) return;

    const result = await Result.updateMany(
      { allocation: allocation._id, status: { $in: fromStatuses } },
      { $set: { status: toStatus, ...extraSet(req) } }
    );

    if (!result.modifiedCount) {
      return res.status(400).json({
        message: `No results are ${fromStatuses.join(" or ")} for this course.`,
      });
    }

    return res.status(200).json({
      message: `${result.modifiedCount} result(s) ${toStatus}.`,
      count: result.modifiedCount,
    });
  } catch (error) {
    console.error(`Transition to ${toStatus} error:`, error);
    return res.status(500).json({ message: `Failed to mark results as ${toStatus}.` });
  }
};

export const approveResults = transition(["submitted"], "approved", (req) => ({
  approvedBy: req.user.userId,
  approvedAt: new Date(),
}));

export const publishResults = transition(["approved"], "published", (req) => ({
  publishedBy: req.user.userId,
  publishedAt: new Date(),
}));

export const unpublishResults = transition(["published"], "approved", () => ({
  publishedAt: null,
  publishedBy: null,
}));

export const returnResults = async (req, res) => {
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) {
    return res.status(400).json({ message: "Give a reason for returning these results." });
  }
  return transition(["submitted", "approved"], "draft", () => ({
    returnReason: reason,
    submittedAt: null,
  }))(req, res);
};

/* ------------------------------------------------------------------ */
/* STUDENT: PUBLISHED RESULTS, GPA PER SEMESTER, CGPA PER SESSION       */
/* ------------------------------------------------------------------ */
export const getMyResults = async (req, res) => {
  try {
    // Only published results are ever returned to a student
    const rows = await Result.find({
      student: req.user.userId,
      status: "published",
    })
      .populate("academicSession", "name")
      .populate("course", "code title")
      .sort({ createdAt: 1 })
      .lean();

    const sessions = new Map();

    for (const r of rows) {
      const sid = String(idOf(r.academicSession));
      if (!sessions.has(sid)) {
        sessions.set(sid, {
          session: r.academicSession?.name || "",
          rows: [],
          bySemester: new Map(),
        });
      }
      const s = sessions.get(sid);
      s.rows.push(r);
      if (!s.bySemester.has(r.semester)) s.bySemester.set(r.semester, []);
      s.bySemester.get(r.semester).push(r);
    }

    const shapeRow = (r) => ({
      code: r.course?.code || "",
      title: r.course?.title || "",
      creditUnits: r.creditUnits,
      caScore: r.caScore,
      examScore: r.examScore,
      total: r.total,
      grade: r.grade,
      gradePoint: r.gradePoint,
      comment: r.comment || "",
    });

    const data = [...sessions.values()].map((s) => {
      const semesters = ["First", "Second"]
        .filter((sem) => s.bySemester.has(sem))
        .map((sem) => {
          const list = s.bySemester.get(sem);
          const { gpa, units } = computeGPA(list);
          return { semester: sem, gpa, units, results: list.map(shapeRow) };
        });

      // Session CGPA combines every published semester in the session
      const session = computeGPA(s.rows);

      return {
        session: s.session,
        semesters,
        cgpa: session.gpa,
        units: session.units,
      };
    });

    const overall = computeGPA(rows);

    return res.status(200).json({
      sessions: data,
      cgpa: overall.gpa,
      totalUnits: overall.units,
    });
  } catch (error) {
    console.error("Get my results error:", error);
    return res.status(500).json({ message: "Failed to load your results." });
  }
};