import express from "express";

import {
  createAcademicSession,
  getAcademicSessions,
  updateAcademicSession,
  deleteAcademicSession,
} from "../controllers/academicSessionController.js";

const router = express.Router();


router.post(
  "/",
  createAcademicSession
);

router.get(
  "/",
  getAcademicSessions
);

router.put(
  "/:id",
  updateAcademicSession
);

router.delete(
  "/:id",
  deleteAcademicSession
);


export default router;