/* global process */

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import Setting from "../models/settingModel.js";
import Account from "../models/accountModel.js";
import Download from "../models/downloadModel.js";
import Exam from "../models/examModel.js";

import Application from "../models/applicationModel.js";

// export const register = async (req, res) => {
//   try {
//     const { role, sessionId, ...userData } = req.body;
//     const { username, password } = userData;

//     console.log("Received registration data:", { role, sessionId, userData });

//     if (!["admin", "staff", "student"].includes(role)) {
//       return res.status(400).json({ error: "Invalid role" });
//     }

//     const existingUser = await User.findOne({ username }).exec();
//     if (existingUser) {
//       return res.status(400).json({ error: "Username already exists" });
//     }

//     const session = await Session.findById(sessionId);
//     if (!session) {
//       return res.status(400).json({ error: "Invalid session ID" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = new User({
//       role,
//       ...userData,
//       password: hashedPassword,
//       session: [sessionId], // session is an array on the new model
//     });

//     await user.save();

//     const token = jwt.sign(
//       { userId: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "12h" }
//     );

//     return res.status(201).json({ token, user });
//   } catch (error) {
//     console.error("Registration error:", error);
//     return res.status(500).json({ error: "Registration failed" });
//   }
// };

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return res.status(500).json({ error: "Failed to get user" });
  }
};
// export const register = async (req, res) => {
//   try {
//     const { role, sessionId, ...userData } = req.body;
//     const { username, password } = userData;

//     console.log("Received registration data:", { role, sessionId, userData });

//     if (!["admin", "staff", "student"].includes(role)) {
//       return res.status(400).json({ error: "Invalid role" });
//     }

//     const existingUser = await User.findOne({ username }).exec();
//     if (existingUser) {
//       return res.status(400).json({ error: "Username already exists" });
//     }

//     let session;

//     if (role === "student") {
//       // Students don't send a sessionId — auto-enroll into the active session
//       session = await Session.findOne({ isActive: true }).exec();
//       if (!session) {
//         return res.status(400).json({
//           error: "No active academic session is configured. Contact admissions.",
//         });
//       }
//     } else {
//       // Admin/staff still need an explicit sessionId
//       if (!sessionId) {
//         return res.status(400).json({ error: "sessionId is required" });
//       }
//       session = await Session.findById(sessionId).exec();
//       if (!session) {
//         return res.status(400).json({ error: "Invalid session ID" });
//       }
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = new User({
//       role,
//       ...userData,
//       password: hashedPassword,
//       session: [session._id],
//     });

//     await user.save();

//     const token = jwt.sign(
//       { userId: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "12h" }
//     );

//     return res.status(201).json({ token, user });
//   } catch (error) {
//     console.error("Registration error:", error);
//     return res.status(500).json({ error: "Registration failed" });
//   }
// };


// export const register = async (req, res) => {
//   try {
//     const { role, sessionId, ...userData } = req.body;
//     const { username, password } = userData;

//     if (!["admin", "staff", "student"].includes(role)) {
//       return res.status(400).json({ error: "Invalid role" });
//     }

//     const existingUser = await User.findOne({ username }).exec();
//     if (existingUser) {
//       return res.status(400).json({ error: "Username already exists" });
//     }

//     let session;

//     if (role === "student") {
//       session = await Session.findOne({ isActive: true }).exec();
//       if (!session) {
//         return res.status(400).json({
//           error: "No active academic session is configured. Contact admissions.",
//         });
//       }
//     } else {
//       if (!sessionId) {
//         return res.status(400).json({ error: "sessionId is required" });
//       }
//       session = await Session.findById(sessionId).exec();
//       if (!session) {
//         return res.status(400).json({ error: "Invalid session ID" });
//       }
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = new User({
//       role,
//       ...userData,
//       password: hashedPassword,
//       session: [session._id],
//     });

//     await user.save();

//     // Create the Application record for students only
//     let application;
//     if (role === "student") {
//       const year = new Date().getFullYear();
//       const countThisYear = await Application.countDocuments({
//         applicationNumber: { $regex: `^APP-${year}-` },
//       });
//       const sequence = String(countThisYear + 1).padStart(6, "0");
//       const applicationNumber = `APP-${year}-${sequence}`;

//       application = await Application.create({
//         user: user._id,
//         session: session._id,
//         applicationNumber,
//         programme: userData.programme,
//       });
//     }

//     const token = jwt.sign(
//       { userId: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "12h" }
//     );

//     return res.status(201).json({ token, user, application });
//   } catch (error) {
//     console.error("Registration error:", error);
//     return res.status(500).json({ error: "Registration failed" });
//   }
// };

export const register = async (req, res) => {
  try {
    const { role, sessionId, ...userData } = req.body;
    const { username, password } = userData;

    if (!["admin", "staff", "student"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const existingUser = await User.findOne({ username }).exec();
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    let session;

    if (role === "student") {
      session = await Session.findOne({ isActive: true }).exec();
      if (!session) {
        return res.status(400).json({
          error: "No active academic session is configured. Contact admissions.",
        });
      }
    } else {
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      session = await Session.findById(sessionId).exec();
      if (!session) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      role,
      ...userData,
      password: hashedPassword,
      session: [session._id],
    });

    await user.save();
    console.log("[register] User created:", user._id.toString(), "role:", role);

    let application;
    if (role === "student") {
      console.log("[register] Creating Application for student...");
      const year = new Date().getFullYear();
      const countThisYear = await Application.countDocuments({
        applicationNumber: { $regex: `^APP-${year}-` },
      });
      const sequence = String(countThisYear + 1).padStart(6, "0");
      const applicationNumber = `APP-${year}-${sequence}`;

      application = await Application.create({
        user: user._id,
        session: session._id,
        applicationNumber,
        programme: userData.programme,
      });
      console.log("[register] Application created:", application._id.toString(), applicationNumber);
    } else {
      console.log("[register] Skipped Application creation — role is", role);
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.status(201).json({ token, user, application });
  } catch (error) {
    console.error("[register] Registration error:", error);
    return res.status(500).json({ error: "Registration failed" });
  }
};
export const login = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).exec();

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const storedPassword = String(user.password || "");
    const looksHashed =
      storedPassword.startsWith("$2a$") ||
      storedPassword.startsWith("$2b$") ||
      storedPassword.startsWith("$2y$");

    const isPasswordValid = looksHashed
      ? bcrypt.compareSync(password, storedPassword)
      : password === storedPassword;

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.status(200).json({ token, user });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
};

// ---------- generic role/session lookups ----------

export const getUserByRole = async (req, res) => {
  const { role, sessionId } = req.params;

  try {
    const users = await User.find({ role, session: sessionId }).exec();

    if (!users || users.length === 0) {
      return res
        .status(404)
        .json({ error: "No users found with that role and session" });
    }

    return res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Failed to get users" });
  }
};

export const deleteUser = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ error: "No user found with that ID" });
    }
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
};

export const deleteUserFromSpecificSession = async (req, res) => {
  const { userId, sessionId } = req.params;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { session: sessionId } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res
      .status(200)
      .json({ message: "Session removed", user: updatedUser });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error removing session", details: error.message });
  }
};

// ---------- admin ----------

export const getAdmin = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const admins = await User.find({ role: "admin", session: sessionId })
      .select("username email address phone _id")
      .exec();

    if (admins.length === 0) {
      return res
        .status(404)
        .json({ message: "No admins found for that session" });
    }

    return res.status(200).json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({ message: "Failed to get admins" });
  }
};

export const getAdminById = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.json({ admin });
  } catch (error) {
    console.error("Error fetching admin by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, password, ...updateData } = req.body;

    if (sessionId) {
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      // add without duplicating; use findByIdAndUpdate below with $addToSet
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedAdmin = await User.findByIdAndUpdate(
      id,
      {
        ...updateData,
        ...(sessionId ? { $addToSet: { session: sessionId } } : {}),
      },
      { new: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(updatedAdmin);
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ---------- staff ----------

export const updateStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, password, ...updateData } = req.body;

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedStaff = await User.findByIdAndUpdate(
      id,
      {
        ...updateData,
        ...(sessionId ? { $addToSet: { session: sessionId } } : {}),
      },
      { new: true }
    );

    if (!updatedStaff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    res.status(200).json(updatedStaff);
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getStaffById = async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    res.json({ staff });
  } catch (error) {
    console.error("Error fetching staff by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- students ----------

export const updateStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, password, ...updateData } = req.body;

    console.log("Incoming data:", req.body);

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedStudent = await User.findByIdAndUpdate(
      id,
      {
        ...updateData,
        ...(sessionId ? { $addToSet: { session: sessionId } } : {}),
      },
      { new: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json(updatedStudent);
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json({ student });
  } catch (error) {
    console.error("Error fetching student by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getStudentByIdBySession = async (req, res) => {
  const { id, sessionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid student ID" });
  }

  try {
    const student = await User.find({ _id: id, session: sessionId }).exec();

    if (!student || student.length === 0) {
      return res.status(404).json({ error: "No student found with that ID" });
    }

    return res.status(200).json(student);
  } catch (error) {
    console.error("Error fetching student by session:", error);
    return res.status(500).json({ error: "Failed to get student" });
  }
};

export const getStudentsBySession = async (req, res) => {
  const { sessionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return res.status(400).json({ error: "Invalid session ID" });
  }

  try {
    const students = await User.find({
      role: "student",
      session: sessionId,
    }).exec();

    if (students.length === 0) {
      return res
        .status(404)
        .json({ error: "No students found for that session" });
    }

    return res.status(200).json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    return res.status(500).json({ error: "Failed to get students" });
  }
};

// Replaces getStudentsByClass — now scoped by programme + level
export const getStudentsByProgramme = async (req, res) => {
  const { programme, level, sessionId } = req.params;

  try {
    const students = await User.find({
      role: "student",
      programme,
      level,
      session: sessionId,
    })
      .select(
        "matricNo studentName address phone email programme level studyMode _id"
      )
      .exec();

    if (students.length === 0) {
      return res
        .status(404)
        .json({ error: "No students found in that programme/level and session" });
    }

    return res.status(200).json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    return res.status(500).json({ error: "Failed to get students" });
  }
};

// Promote students from one level (e.g. ND1) to the next (ND2) and roll
// them into a new session. Pass a map like { ND1: "ND2" }.
export const promoteStudents = async (req, res) => {
  try {
    const { fromSessionId, toSessionId, levelPromotions } = req.body;

    const fromSession = await Session.findById(fromSessionId);
    const toSession = await Session.findById(toSessionId);
    if (!fromSession || !toSession) {
      return res.status(400).json({ error: "Invalid session ID(s)" });
    }

    const students = await User.find({
      role: "student",
      session: fromSessionId,
    });

    if (students.length === 0) {
      return res
        .status(404)
        .json({ message: "No students found in the provided session." });
    }

    let promotedCount = 0;

    for (const student of students) {
      const currentLevel = student.level;
      const nextLevel = levelPromotions[currentLevel];
      if (!nextLevel) continue; // e.g. ND2 with no mapping = graduating, skip

      if (!student.promotionHistory) student.promotionHistory = [];
      student.promotionHistory.push({
        fromLevel: currentLevel,
        toLevel: nextLevel,
        fromSession: fromSessionId,
        toSession: toSessionId,
        promotedAt: new Date(),
      });

      student.level = nextLevel;
      if (!student.session.includes(toSessionId)) {
        student.session.push(toSessionId);
      }

      await student.save();
      promotedCount++;
    }

    res.status(200).json({
      success: true,
      message: `${promotedCount} students promoted from ${fromSession.name} to ${toSession.name}.`,
    });
  } catch (error) {
    console.error("Promotion Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// ---------- bulk/session-migration helpers ----------

export const updatePasswords = async (req, res) => {
  try {
    const usersToUpdate = await User.find({ password: "" });

    if (usersToUpdate.length === 0) {
      return res
        .status(200)
        .json({ message: "No users found with empty passwords." });
    }

    for (const user of usersToUpdate) {
      const newPassword = "poly12345";
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      console.log(`Updated password for user: ${user.username}`);
    }

    res.status(200).json({
      message: "Password updates completed.",
      updatedUsersCount: usersToUpdate.length,
    });
  } catch (error) {
    console.error("Error updating passwords:", error);
    res.status(500).json({ error: "Error updating passwords." });
  }
};

export const addSessionToUsersWithoutSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const updateResult = await User.updateMany(
      { $or: [{ session: { $exists: false } }, { session: { $size: 0 } }] },
      { $addToSet: { session: sessionId } }
    );

    res.status(200).json({
      message: "Users updated successfully",
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

export const addAnotherSessionToUserWithSession = async (req, res) => {
  try {
    const { sessionIds } = req.body;

    if (!Array.isArray(sessionIds)) {
      return res.status(400).json({ error: "sessionIds must be an array" });
    }

    const validSessions = await Session.find({ _id: { $in: sessionIds } });
    if (validSessions.length !== sessionIds.length) {
      return res
        .status(400)
        .json({ error: "One or more session IDs are invalid" });
    }

    const updateResult = await User.updateMany(
      {},
      { $addToSet: { session: { $each: sessionIds } } }
    );

    res.status(200).json({
      message: "Sessions added successfully",
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const addSessionToDownloadWithoutSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const updateResult = await Download.updateMany(
      { session: { $exists: false } },
      { $set: { session: sessionId } }
    );

    res.status(200).json({
      message: "Downloads updated successfully",
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// ---------- school settings / accounts (unchanged in shape) ----------

export const createSetting = async (req, res) => {
  try {
    const { name, principalName, resumptionDate, examName, session } = req.body;

    const exam = await Exam.findById(examName);
    if (!exam) {
      return res.status(400).json({ success: false, message: "Exam not found" });
    }

    let school = await Setting.findOne({ session, exam: exam._id });
    if (!school) {
      school = new Setting();
    }

    school.name = name;
    school.principalName = principalName;
    school.resumptionDate = resumptionDate;
    school.session = session;
    school.exam = exam._id;

    if (req.file) {
      school.signature = req.file.location;
      school.markModified("signature");
    }

    await school.save();

    res.status(200).json({
      success: true,
      message: school.isNew
        ? "School profile created successfully"
        : "School profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating school profile:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getSetting = async (req, res) => {
  try {
    const { sessionId } = req.query;
    const term = decodeURIComponent(req.query.term);

    if (!sessionId || !term) {
      return res
        .status(400)
        .json({ success: false, message: "Missing sessionId or term." });
    }

    const exam = await Exam.findOne({ name: term, session: sessionId });
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found for the specified term.",
      });
    }

    const setting = await Setting.findOne({ session: sessionId, exam: exam._id });
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: "School setting not found for the specified session and term.",
      });
    }

    return res.status(200).json({ success: true, data: setting });
  } catch (error) {
    console.error("Error fetching school setting:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAccountSetting = async (req, res) => {
  try {
    const schoolSetting = await Account.findOne();
    if (!schoolSetting) {
      return res
        .status(404)
        .json({ success: false, message: "School setting not found" });
    }
    res.status(200).json({ success: true, data: schoolSetting });
  } catch (error) {
    console.error("Error fetching account setting:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createAccount = async (req, res) => {
  try {
    const {
      name,
      motto,
      address,
      phone,
      phonetwo,
      currency,
      email,
      sessionStart,
      sessionEnd,
      session,
    } = req.body;

    if (!session) {
      return res
        .status(400)
        .json({ success: false, message: "Session ID is required" });
    }

    let school = await Account.findOne();
    if (!school) {
      school = new Account();
    }

    school.name = name;
    school.motto = motto;
    school.address = address;
    school.phone = phone;
    school.phonetwo = phonetwo;
    school.currency = currency;
    school.email = email;
    school.sessionStart = sessionStart;
    school.sessionEnd = sessionEnd;
    school.session = session;

    if (req.file) {
      school.schoolLogo = req.file.location;
    }

    await school.save();

    res.status(200).json({
      success: true,
      message: "School profile updated successfully",
      data: school,
    });
  } catch (error) {
    console.error("Error in createAccount:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- all staff for admin ----------

export const getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: "staff" })
      .select(
      "_id staffId username email phone gender birthday address staffRole department subjectTaught employmentType session createdAt updatedAt role"

      )
      .populate("session", "name isActive")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: staff.length,
      staff,
    });
  } catch (error) {
    console.error("Error fetching all staff:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch staff",
    });
  }
};

export const registerStaff = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      staffType,
      department,
      staffRole,
      employmentType,
      employmentDate,
      status,
      gender,
      birthday,
      address,
      subjectTaught,
      password,
      session,
    } = req.body;

    // ==================================================
    // VALIDATION
    // ==================================================

    if (
      !firstName?.trim() ||
      !lastName?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !department ||
      !staffRole ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "First name, last name, email, phone, department, role and password are required.",
      });
    }

    // ==================================================
    // CHECK EXISTING EMAIL
    // ==================================================

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    // ==================================================
    // GENERATE USERNAME
    // Example: johnsmith
    // ==================================================

    const baseUsername = `${firstName}${lastName}`
      .replace(/\s+/g, "")
      .toLowerCase();

    let username = baseUsername;

    let counter = 1;

    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // ==================================================
    // GENERATE STAFF ID
    // Example: STF/2026/001
    // ==================================================

    const year = new Date().getFullYear();

    const lastStaff = await User.findOne({
      role: "staff",
      staffId: {
        $regex: `^STF/${year}/`,
      },
    })
      .sort({ staffId: -1 })
      .lean();

    let nextNumber = 1;

    if (lastStaff?.staffId) {
      const parts = lastStaff.staffId.split("/");
      const lastNumber = Number(parts[2]);

      if (!Number.isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const staffId = `STF/${year}/${String(
      nextNumber
    ).padStart(3, "0")}`;

    // ==================================================
    // HASH PASSWORD
    // ==================================================

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // ==================================================
    // CREATE STAFF
    // ==================================================

    const staff = await User.create({
      staffId,

      username,

      fullname: `${firstName.trim()} ${lastName.trim()}`,

      email: normalizedEmail,

      password: hashedPassword,

      role: "staff",

      phone: phone.trim(),

      gender: gender || undefined,

      birthday: birthday || undefined,

      address: address || undefined,

      staffType: staffType || "Non-Academic Staff",

      staffRole,

      department,

      subjectTaught:
        staffType === "Lecturer"
          ? subjectTaught || undefined
          : undefined,

      employmentType:
        employmentType || "Full-time",

      employmentDate:
        employmentDate || undefined,

      status: status || "Active",

      session: session || undefined,
    });

    // ==================================================
    // RETURN CREATED STAFF
    // ==================================================

    const createdStaff = await User.findById(
      staff._id
    )
      .select(
        `
        _id
        staffId
        username
        fullname
        email
        phone
        gender
        birthday
        address
        staffType
        staffRole
        department
        subjectTaught
        employmentType
        employmentDate
        status
        session
        createdAt
        updatedAt
        role
        `
      )
      .populate(
        "session",
        "name isActive"
      )
      .lean();

    return res.status(201).json({
      success: true,
      message: "Staff registered successfully.",
      staff: createdStaff,
    });
  } catch (error) {
    console.error(
      "Error registering staff:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to register staff.",
    });
  }
};