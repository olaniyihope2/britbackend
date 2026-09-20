// routes/studentCourseRoutes.js
import express from "express";

import {
  getRegistrationCourses,
  submitRegistration,
} from "../controller/StudentCourseController.js";

// Use whatever auth middleware you already have for logged-in users.
// It must set req.user for the logged-in student.
import  protect  from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/registration", protect, getRegistrationCourses);

router.post("/registration", protect, submitRegistration);

export default router;

/*
  Then, in server.js / app.js:

  import studentCourseRoutes from "./routes/studentCourseRoutes.js";

  app.use("/api/student/courses", studentCourseRoutes);
*/