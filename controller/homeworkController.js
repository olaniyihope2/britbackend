import HomeworkSubmission from "../models/homeworkSubmissionModel.js";
import User from "../models/userModel.js";
import { callGemini } from "../services/geminiService.js";

export const askHomeworkAssistant = async (req, res) => {
  try {
    const { question, className, subject } = req.body;
    if (!question) {
      return res.status(400).json({ message: "Question is required." });
    }

    const answer = await callGemini(
      `You are helping a student with homework.
Class: ${className || "Unknown"}
Subject: ${subject || "General"}
Student question: ${question}

Reply in a warm, clear way. Keep it text only. Explain simply, then give a short next step.`,
      {
        systemInstruction:
          "You are a school homework tutor. Be accurate, concise, and encouraging. Return plain text only.",
        maxOutputTokens: 900,
        temperature: 0.5,
      }
    );

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("askHomeworkAssistant error:", error);
    return res.status(500).json({ message: error?.message || "Homework assistant failed." });
  }
};

export const createHomeworkSubmission = async (req, res) => {
  try {
    const studentId = req.user?._id || req.user?.id;
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    const submission = await HomeworkSubmission.create({
      title: req.body.title,
      subject: req.body.subject,
      prompt: req.body.prompt,
      answerText: req.body.answerText,
      attachmentName: req.file?.originalname || req.body.attachmentName || "",
      attachmentUrl: req.file ? `/uploads/homework/${req.file.filename}` : "",
      className: req.body.className || student.classname,
      session: req.body.session,
      student: student._id,
      studentName: student.studentName || student.username,
      admissionNumber: student.AdmNo,
    });

    return res.status(201).json({ message: "Homework submitted successfully.", submission });
  } catch (error) {
    console.error("createHomeworkSubmission error:", error);
    return res.status(500).json({ message: "Failed to submit homework." });
  }
};

export const getHomeworkSubmissions = async (req, res) => {
  try {
    const { sessionId, className, studentId } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?._id || req.user?.id;
    const query = {};

    if (sessionId) query.session = sessionId;
    if (className) query.className = className;
    if (studentId) query.student = studentId;

    if (userRole === "student") {
      query.student = userId;
    }

    if (userRole === "parent") {
      const parent = await User.findById(userId).lean();
      query.student = { $in: parent?.linkedStudentIds || [] };
    }

    const submissions = await HomeworkSubmission.find(query).sort({ createdAt: -1 });
    return res.status(200).json(submissions);
  } catch (error) {
    console.error("getHomeworkSubmissions error:", error);
    return res.status(500).json({ message: "Failed to fetch homework submissions." });
  }
};

export const gradeHomeworkSubmission = async (req, res) => {
  try {
    const submission = await HomeworkSubmission.findByIdAndUpdate(
      req.params.id,
      {
        grade: req.body.grade,
        feedback: req.body.feedback,
        status: req.body.status || "graded",
        gradedBy: req.user?._id || req.user?.id,
      },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ message: "Homework submission not found." });
    }

    return res.status(200).json({ message: "Homework graded successfully.", submission });
  } catch (error) {
    console.error("gradeHomeworkSubmission error:", error);
    return res.status(500).json({ message: "Failed to grade homework." });
  }
};
