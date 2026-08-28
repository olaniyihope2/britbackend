import express from "express";

import {
  assignCourse,
  getCourseAllocations,
  updateCourseAllocation,
   getMyCourseAllocations,
  deleteCourseAllocation,
   getCourseAllocationById
} from "../controller/courseAllocationController.js";
import authenticateUser from "../middleware/authMiddleware.js";

const router = express.Router();


router.post(
  "/",
  assignCourse
);

router.get(
  "/",
  getCourseAllocations
);
router.get(
  "/my",
  authenticateUser,
  getMyCourseAllocations
);
router.get(
  "/:id",
  authenticateUser,
  getCourseAllocationById
);

router.put(
  "/:id",
  updateCourseAllocation
);

router.delete(
  "/:id",
  deleteCourseAllocation
);


export default router;