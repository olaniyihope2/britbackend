import CourseRegistration from "../models/CourseRegistration.js";

// Course ids a student is registered for (one registration doc per semester,
// holding a `courses` array).
export const getEnrolledCourseIds = async (userId) => {
  const regs = await CourseRegistration.find({ student: userId, status: "Registered" }).select(
    "courses"
  );
  return [...new Set(regs.flatMap((r) => r.courses || []).map(String))];
};

export const isEnrolled = async (userId, courseId) =>
  (await getEnrolledCourseIds(userId)).includes(String(courseId));

// Every student registered for a course (used for attendance lists).
export const getEnrolledStudentIds = async (courseId) => {
  const regs = await CourseRegistration.find({ courses: courseId, status: "Registered" }).select(
    "student"
  );
  return [...new Set(regs.map((r) => String(r.student)))];
};
