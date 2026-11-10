import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  type: {
    type: String,
    enum: ["multiple-choice", "true-false", "short-answer"],
    required: true,
  },
  question: { type: String, required: true, trim: true },
  marks: { type: Number, required: true, min: 1 },
  options: { type: [optionSchema], default: [] },
  correctAnswer: { type: String, required: true, trim: true },
});

const quizSchema = new mongoose.Schema(
  {
    allocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseAllocation",
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    semester: {
      type: String,
      enum: ["First", "Second"],
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    type: {
      type: String,
      enum: ["Test", "Exam"],
      default: "Test",
    },
    title: { type: String, required: true, trim: true },
    instructions: { type: String, default: "", trim: true },
    duration: { type: Number, required: true, min: 1 }, // minutes
    passMark: { type: Number, default: 50, min: 0, max: 100 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    questions: { type: [questionSchema], default: [] },
    totalMarks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Quiz", quizSchema);