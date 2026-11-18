// import mongoose from "mongoose";
// import Result from "../models/Result.js"; // adjust to your Result model's file name
// import CourseAllocation from "../models/CourseAllocation.js";
// import CourseRegistration from "../models/CourseRegistration.js";
// import Session from "../models/sessionModel.js";

// const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// const adminOnly = (req, res) => {
//   if (!req.isAdmin) {
//     res.status(403).json({ message: "Only administrators can review results." });
//     return false;
//   }
//   return true;
// };

// // "First Semester" / "First" -> "First"
// const semKey = (v) => {
//   const s = String(v || "").toLowerCase();
//   if (s.startsWith("first")) return "First";
//   if (s.startsWith("second")) return "Second";
//   return "";
// };

// const emptyCounts = () => ({
//   total: 0, graded: 0, draft: 0, submitted: 0, approved: 0, published: 0,
// });

// const deriveStatus = (c) => {
//   if (c.total === 0) return "Not started";
//   if (c.draft > 0) return "Draft";
//   if (c.submitted > 0) return "Pending approval";
//   if (c.published === c.total) return "Published";
//   return "Approved";
// };

// const lecturerName = (staff) =>
//   staff?.fullname || staff?.studentName || staff?.username || "Unknown lecturer";

// /* ------------------------------------------------------------------ */
// /* OVERVIEW: one row per allocated course in a session                 */
// /* GET /results/admin/overview?sessionId=...                           */
// /* ------------------------------------------------------------------ */
// export const getResultsOverview = async (req, res) => {
//   try {
//     if (!adminOnly(req, res)) return;

//     const { sessionId } = req.query;
//     if (!isValidId(sessionId)) {
//       return res.status(400).json({ message: "Invalid session ID." });
//     }

//     const session = await Session.findById(sessionId).select("name");
//     if (!session) return res.status(404).json({ message: "Session not found." });

//     const allocations = await CourseAllocation.find({
//       academicSession: sessionId,
//       status: "Active",
//     })
//       .populate("course", "code title")
//       .populate("staff", "fullname studentName username")
//       .populate("department", "name code")
//       .lean();

//     const ids = allocations.map((a) => a._id);

//     const [groups, registrations] = await Promise.all([
//       Result.aggregate([
//         { $match: { allocation: { $in: ids } } },
//         {
//           $group: {
//             _id: { allocation: "$allocation", status: "$status" },
//             count: { $sum: 1 },
//             graded: { $sum: { $cond: [{ $isNumber: "$total" }, 1, 0] } },
//             updatedAt: { $max: "$updatedAt" },
//           },
//         },
//       ]),
//       CourseRegistration.aggregate([
//         { $match: { session: session.name, status: "Registered" } },
//         { $unwind: "$courses" },
//         { $group: { _id: { course: "$courses", semester: "$semester" }, count: { $sum: 1 } } },
//       ]),
//     ]);

//     const countsByAllocation = new Map();
//     const lastUpdated = new Map();

//     for (const g of groups) {
//       const key = String(g._id.allocation);
//       const c = countsByAllocation.get(key) || emptyCounts();
//       c.total += g.count;
//       c.graded += g.graded;
//       if (c[g._id.status] !== undefined) c[g._id.status] += g.count;
//       countsByAllocation.set(key, c);

//       const prev = lastUpdated.get(key);
//       if (!prev || g.updatedAt > prev) lastUpdated.set(key, g.updatedAt);
//     }

//     const registered = new Map(
//       registrations.map((r) => [`${r._id.course}|${semKey(r._id.semester)}`, r.count])
//     );

//     const records = allocations.map((a) => {
//       const c = countsByAllocation.get(String(a._id)) || emptyCounts();
//       return {
//         id: String(a._id),
//         courseCode: a.course?.code || "—",
//         courseTitle: a.course?.title || "Untitled course",
//         lecturer: lecturerName(a.staff),
//         department: a.department?.name || "—",
//         level: a.level || "—",
//         semester: a.semester || "",
//         students: registered.get(`${a.course?._id}|${semKey(a.semester)}`) || 0,
//         graded: c.graded,
//         status: deriveStatus(c),
//         lastUpdated: lastUpdated.get(String(a._id)) || null,
//       };
//     });

//     return res.status(200).json({ records });
//   } catch (error) {
//     console.error("Results overview error:", error);
//     return res.status(500).json({ message: "Failed to load the grade book." });
//   }
// };

// /* ------------------------------------------------------------------ */
// /* DETAIL: every saved result for one course                           */
// /* GET /results/admin/allocation/:allocationId                         */
// /* ------------------------------------------------------------------ */
// export const getAllocationResults = async (req, res) => {
//   try {
//     if (!adminOnly(req, res)) return;

//     const { allocationId } = req.params;
//     if (!isValidId(allocationId)) {
//       return res.status(400).json({ message: "Invalid course allocation ID." });
//     }

//     const allocation = await CourseAllocation.findById(allocationId)
//       .populate("course", "code title")
//       .populate("staff", "fullname studentName username")
//       .populate("department", "name code")
//       .populate("academicSession", "name")
//       .lean();

//     if (!allocation) return res.status(404).json({ message: "Course allocation not found." });

//     const rows = await Result.find({ allocation: allocation._id })
//       .populate("student", "studentName username matricNo")
//       .lean();

//     const counts = emptyCounts();
//     const students = rows
//       .map((r) => {
//         counts.total += 1;
//         if (typeof r.total === "number") counts.graded += 1;
//         if (counts[r.status] !== undefined) counts[r.status] += 1;

//         return {
//           resultId: String(r._id),
//           name: r.student?.studentName || r.student?.username || "Unknown student",
//           matricNumber: r.student?.matricNo || "—",
//           caScore: r.caScore ?? null,
//           examScore: r.examScore ?? null,
//           total: r.total ?? null,
//           grade: r.grade ?? null,
//           comment: r.comment || "",
//           status: r.status,
//         };
//       })
//       .sort((a, b) => a.name.localeCompare(b.name));

//     return res.status(200).json({
//       allocation: {
//         id: String(allocation._id),
//         courseCode: allocation.course?.code || "—",
//         courseTitle: allocation.course?.title || "Untitled course",
//         lecturer: lecturerName(allocation.staff),
//         department: allocation.department?.name || "—",
//         level: allocation.level || "—",
//         semester: allocation.semester || "",
//         session: allocation.academicSession?.name || "",
//         status: deriveStatus(counts),
//       },
//       students,
//       counts,
//     });
//   } catch (error) {
//     console.error("Allocation results error:", error);
//     return res.status(500).json({ message: "Failed to load results." });
//   }
// };

// /* ------------------------------------------------------------------ */
// /* APPROVE: submitted -> approved                                      */
// /* POST /results/admin/allocation/:allocationId/approve                */
// /* ------------------------------------------------------------------ */
// export const approveAllocationResults = async (req, res) => {
//   try {
//     if (!adminOnly(req, res)) return;

//     const { allocationId } = req.params;
//     if (!isValidId(allocationId)) {
//       return res.status(400).json({ message: "Invalid course allocation ID." });
//     }

//     const drafts = await Result.countDocuments({ allocation: allocationId, status: "draft" });
//     if (drafts > 0) {
//       return res.status(400).json({
//         message: `${drafts} result${drafts === 1 ? " is" : "s are"} still a draft. Wait for the lecturer to submit.`,
//       });
//     }

//     const update = await Result.updateMany(
//       { allocation: allocationId, status: "submitted" },
//       { $set: { status: "approved", reviewedBy: req.user.userId, reviewedAt: new Date(), reviewNote: "" } }
//     );

//     if (update.modifiedCount === 0) {
//       return res.status(400).json({ message: "There are no submitted results to approve." });
//     }

//     return res.status(200).json({
//       message: `${update.modifiedCount} result${update.modifiedCount === 1 ? "" : "s"} approved.`,
//     });
//   } catch (error) {
//     console.error("Approve results error:", error);
//     return res.status(500).json({ message: "Failed to approve results." });
//   }
// };

// /* ------------------------------------------------------------------ */
// /* RETURN: submitted -> draft, so the lecturer can correct them        */
// /* POST /results/admin/allocation/:allocationId/return  { note }       */
// /* ------------------------------------------------------------------ */
// export const returnAllocationResults = async (req, res) => {
//   try {
//     if (!adminOnly(req, res)) return;

//     const { allocationId } = req.params;
//     if (!isValidId(allocationId)) {
//       return res.status(400).json({ message: "Invalid course allocation ID." });
//     }

//     const note = String(req.body?.note ?? "").trim();
//     if (!note) {
//       return res.status(400).json({ message: "Add a note telling the lecturer what to correct." });
//     }

//     const update = await Result.updateMany(
//       { allocation: allocationId, status: "submitted" },
//       { $set: { status: "draft", reviewedBy: req.user.userId, reviewedAt: new Date(), reviewNote: note } }
//     );

//     if (update.modifiedCount === 0) {
//       return res.status(400).json({ message: "There are no submitted results to return." });
//     }

//     return res.status(200).json({ message: "Results returned to the lecturer." });
//   } catch (error) {
//     console.error("Return results error:", error);
//     return res.status(500).json({ message: "Failed to return results." });
//   }
// };

// /* ------------------------------------------------------------------ */
// /* PUBLISH: approved -> published                                      */
// /* POST /results/admin/allocation/:allocationId/publish                */
// /* ------------------------------------------------------------------ */
// export const publishAllocationResults = async (req, res) => {
//   try {
//     if (!adminOnly(req, res)) return;

//     const { allocationId } = req.params;
//     if (!isValidId(allocationId)) {
//       return res.status(400).json({ message: "Invalid course allocation ID." });
//     }

//     const update = await Result.updateMany(
//       { allocation: allocationId, status: "approved" },
//       { $set: { status: "published", publishedAt: new Date() } }
//     );

//     if (update.modifiedCount === 0) {
//       return res.status(400).json({ message: "There are no approved results to publish." });
//     }

//     return res.status(200).json({ message: "Results published to students." });
//   } catch (error) {
//     console.error("Publish results error:", error);
//     return res.status(500).json({ message: "Failed to publish results." });
//   }
// };
import mongoose from "mongoose";
import Result from "../models/Result.js";
import CourseAllocation from "../models/CourseAllocation.js";
import CourseRegistration from "../models/CourseRegistration.js";
import Session from "../models/sessionModel.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const adminOnly = (req, res) => {
  if (!req.isAdmin) {
    res.status(403).json({ message: "Only administrators can review results." });
    return false;
  }
  return true;
};

// "First Semester" / "First" -> "First"
const semKey = (v) => {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("first")) return "First";
  if (s.startsWith("second")) return "Second";
  return "";
};

const emptyCounts = () => ({
  total: 0, graded: 0, draft: 0, submitted: 0, approved: 0, published: 0,
});

const deriveStatus = (c) => {
  if (c.total === 0) return "Not started";
  if (c.draft > 0) return "Draft";
  if (c.submitted > 0) return "Pending approval";
  if (c.published === c.total) return "Published";
  return "Approved";
};

const lecturerName = (staff) =>
  staff?.fullname || staff?.studentName || staff?.username || "Unknown lecturer";

/* ------------------------------------------------------------------ */
/* OVERVIEW: one row per allocated course in a session                 */
/* GET /results/admin/overview?sessionId=...                           */
/* ------------------------------------------------------------------ */
export const getResultsOverview = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const { sessionId } = req.query;
    if (!isValidId(sessionId)) {
      return res.status(400).json({ message: "Invalid session ID." });
    }

    const session = await Session.findById(sessionId).select("name");
    if (!session) return res.status(404).json({ message: "Session not found." });

    const allocations = await CourseAllocation.find({
      academicSession: sessionId,
      status: "Active",
    })
      .populate("course", "code title")
      .populate("staff", "fullname studentName username")
      .populate("department", "name code")
      .lean();

    const ids = allocations.map((a) => a._id);

    const [groups, registrations] = await Promise.all([
      Result.aggregate([
        { $match: { allocation: { $in: ids } } },
        {
          $group: {
            _id: { allocation: "$allocation", status: "$status" },
            count: { $sum: 1 },
            graded: { $sum: { $cond: [{ $isNumber: "$total" }, 1, 0] } },
            updatedAt: { $max: "$updatedAt" },
          },
        },
      ]),
      CourseRegistration.aggregate([
        { $match: { session: session.name, status: "Registered" } },
        { $unwind: "$courses" },
        { $group: { _id: { course: "$courses", semester: "$semester" }, count: { $sum: 1 } } },
      ]),
    ]);

    const countsByAllocation = new Map();
    const lastUpdated = new Map();

    for (const g of groups) {
      const key = String(g._id.allocation);
      const c = countsByAllocation.get(key) || emptyCounts();
      c.total += g.count;
      c.graded += g.graded;
      if (c[g._id.status] !== undefined) c[g._id.status] += g.count;
      countsByAllocation.set(key, c);

      const prev = lastUpdated.get(key);
      if (!prev || g.updatedAt > prev) lastUpdated.set(key, g.updatedAt);
    }

    const registered = new Map(
      registrations.map((r) => [`${r._id.course}|${semKey(r._id.semester)}`, r.count])
    );

    const records = allocations.map((a) => {
      const c = countsByAllocation.get(String(a._id)) || emptyCounts();
      return {
        id: String(a._id),
        courseCode: a.course?.code || "—",
        courseTitle: a.course?.title || "Untitled course",
        lecturer: lecturerName(a.staff),
        department: a.department?.name || "—",
        level: a.level || "—",
        semester: a.semester || "",
        students: registered.get(`${a.course?._id}|${semKey(a.semester)}`) || 0,
        graded: c.graded,
        status: deriveStatus(c),
        lastUpdated: lastUpdated.get(String(a._id)) || null,
      };
    });

    return res.status(200).json({ records });
  } catch (error) {
    console.error("Results overview error:", error);
    return res.status(500).json({ message: "Failed to load the grade book." });
  }
};

/* ------------------------------------------------------------------ */
/* DETAIL: every saved result for one course                           */
/* GET /results/admin/allocation/:allocationId                         */
/* ------------------------------------------------------------------ */
export const getAllocationResults = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const { allocationId } = req.params;
    if (!isValidId(allocationId)) {
      return res.status(400).json({ message: "Invalid course allocation ID." });
    }

    const allocation = await CourseAllocation.findById(allocationId)
      .populate("course", "code title")
      .populate("staff", "fullname studentName username")
      .populate("department", "name code")
      .populate("academicSession", "name")
      .lean();

    if (!allocation) return res.status(404).json({ message: "Course allocation not found." });

    const rows = await Result.find({ allocation: allocation._id })
      .populate("student", "studentName username matricNo")
      .lean();

    const counts = emptyCounts();
    const students = rows
      .map((r) => {
        counts.total += 1;
        if (typeof r.total === "number") counts.graded += 1;
        if (counts[r.status] !== undefined) counts[r.status] += 1;

        return {
          resultId: String(r._id),
          name: r.student?.studentName || r.student?.username || "Unknown student",
          matricNumber: r.student?.matricNo || "—",
          caScore: r.caScore ?? null,
          examScore: r.examScore ?? null,
          total: r.total ?? null,
          grade: r.grade ?? null,
          comment: r.comment || "",
          returnReason: r.returnReason || "",
          status: r.status,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // The note is the same on every row returned together, so take the first one
    const returnReason = rows.find((r) => r.returnReason)?.returnReason || "";

    return res.status(200).json({
      allocation: {
        id: String(allocation._id),
        courseCode: allocation.course?.code || "—",
        courseTitle: allocation.course?.title || "Untitled course",
        lecturer: lecturerName(allocation.staff),
        department: allocation.department?.name || "—",
        level: allocation.level || "—",
        semester: allocation.semester || "",
        session: allocation.academicSession?.name || "",
        status: deriveStatus(counts),
        returnReason,
      },
      students,
      counts,
    });
  } catch (error) {
    console.error("Allocation results error:", error);
    return res.status(500).json({ message: "Failed to load results." });
  }
};

/* ------------------------------------------------------------------ */
/* APPROVE: submitted -> approved                                      */
/* POST /results/admin/allocation/:allocationId/approve                */
/* ------------------------------------------------------------------ */
export const approveAllocationResults = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const { allocationId } = req.params;
    if (!isValidId(allocationId)) {
      return res.status(400).json({ message: "Invalid course allocation ID." });
    }

    const drafts = await Result.countDocuments({ allocation: allocationId, status: "draft" });
    if (drafts > 0) {
      return res.status(400).json({
        message: `${drafts} result${drafts === 1 ? " is" : "s are"} still a draft. Wait for the lecturer to submit.`,
      });
    }

    const update = await Result.updateMany(
      { allocation: allocationId, status: "submitted" },
      {
        $set: {
          status: "approved",
          approvedBy: req.user.userId,
          approvedAt: new Date(),
          returnReason: "",
        },
      }
    );

    if (update.modifiedCount === 0) {
      return res.status(400).json({ message: "There are no submitted results to approve." });
    }

    return res.status(200).json({
      message: `${update.modifiedCount} result${update.modifiedCount === 1 ? "" : "s"} approved.`,
    });
  } catch (error) {
    console.error("Approve results error:", error);
    return res.status(500).json({ message: "Failed to approve results." });
  }
};

/* ------------------------------------------------------------------ */
/* RETURN: submitted -> draft, so the lecturer can correct them        */
/* POST /results/admin/allocation/:allocationId/return  { note }       */
/* ------------------------------------------------------------------ */
export const returnAllocationResults = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const { allocationId } = req.params;
    if (!isValidId(allocationId)) {
      return res.status(400).json({ message: "Invalid course allocation ID." });
    }

    const note = String(req.body?.note ?? "").trim();
    if (!note) {
      return res.status(400).json({ message: "Add a note telling the lecturer what to correct." });
    }

    const update = await Result.updateMany(
      { allocation: allocationId, status: "submitted" },
      { $set: { status: "draft", returnReason: note } }
    );

    if (update.modifiedCount === 0) {
      return res.status(400).json({ message: "There are no submitted results to return." });
    }

    return res.status(200).json({ message: "Results returned to the lecturer." });
  } catch (error) {
    console.error("Return results error:", error);
    return res.status(500).json({ message: "Failed to return results." });
  }
};

/* ------------------------------------------------------------------ */
/* PUBLISH: approved -> published                                      */
/* POST /results/admin/allocation/:allocationId/publish                */
/* ------------------------------------------------------------------ */
export const publishAllocationResults = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const { allocationId } = req.params;
    if (!isValidId(allocationId)) {
      return res.status(400).json({ message: "Invalid course allocation ID." });
    }

    const update = await Result.updateMany(
      { allocation: allocationId, status: "approved" },
      { $set: { status: "published", publishedBy: req.user.userId, publishedAt: new Date() } }
    );

    if (update.modifiedCount === 0) {
      return res.status(400).json({ message: "There are no approved results to publish." });
    }

    return res.status(200).json({ message: "Results published to students." });
  } catch (error) {
    console.error("Publish results error:", error);
    return res.status(500).json({ message: "Failed to publish results." });
  }
};