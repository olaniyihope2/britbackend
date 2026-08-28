import express from "express";
import passport from "passport"; // No need to import passport.js directly

import {
  signUp,
  login,
  forgotPassword,
  getProfile,
} from "../controller/jambAuthController.js";
import { protect } from "../middleware/protectUser.js";
import Auth from "../models/authModel.js";
import { generateJWT, generateRefreshToken } from "../utils/jwt.js";
// const { resetDto } = require('../validators/resetPassword')
// const authRouter = express.Router()
const router = express.Router();
// authRouter.route('/signup').post(signupDto, signUp)

// authRouter.route('/reset/password').post(resetDto, resetPassword)

// router.post('/login', signin);
router.post("/jambsignup", signUp);
router.post("/jamblogin", login);

router.get("/profile", protect, getProfile); // New route for fetching profile
router.put("/forgotpassword", forgotPassword);
router.post("/forgotpassword", forgotPassword);
// router.post('/sendpasswordlink', forgotLink)
//  authRouter
//  .route('/reset/password')
//  .post(resetDto, resetPassword);

export default router;
