import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { fileURLToPath } from "url";
import { dirname } from "path";
import authenticateUser from "../middleware/authMiddleware.js";
import { register, login, onboarding } from "../controller/schController.js";
const router = express.Router();





  // Define your routes
  router.post("/sch-register", register);
  router.post("/sch-login", login);

router.patch("/sch-onboarding", authenticateUser, onboarding);




export default router;
