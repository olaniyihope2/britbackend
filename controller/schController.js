import jwt from "jsonwebtoken";
import SchUser from "../models/schModel.js";

// ─── Token Generator ──────────────────────────────────────────────────────────

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// ─── REGISTER ─────────────────────────────────────────────────────────────────

export const register = async (req, res) => {
  try {
    const { username, email, password, role, referralCode } = req.body;

    // ── Validate required fields (role is optional at registration) ───────────
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required.",
      });
    }

    // ── Validate role only if provided ────────────────────────────────────────
    const VALID_ROLES = ["researcher", "academic", "professional"];
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}.`,
      });
    }

    // ── Check duplicate email ─────────────────────────────────────────────────
    const existingEmail = await SchUser.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // ── Check duplicate username ──────────────────────────────────────────────
    const existingUsername = await SchUser.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "This username is already taken. Please choose another.",
      });
    }

    // ── Resolve referral code (optional) ──────────────────────────────────────
    let referredBy = null;
    if (referralCode && referralCode.trim() !== "") {
      const referrer = await SchUser.findOne({
        myReferralCode: referralCode.trim().toUpperCase(),
      });

      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code. Please check and try again.",
        });
      }

      referredBy = referrer._id;
    }

    // ── Create user ───────────────────────────────────────────────────────────
    const user = await SchUser.create({
      username,
      email,
      password,
      role: role || null,
      referralCode: referralCode?.trim().toUpperCase() || null,
      referredBy,
    });

    // ── Generate token ────────────────────────────────────────────────────────
    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        myReferralCode: user.myReferralCode,
        referredBy: user.referredBy || null,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error("Register error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `An account with this ${field} already exists.`,
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages[0],
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};
// ─── LOGIN ────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await SchUser.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id:              user._id,
        username:        user.username,
        email:           user.email,
        role:            user.role,
        profileComplete: user.profileComplete, // ✅ added
        myReferralCode:  user.myReferralCode,
        createdAt:       user.createdAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};
export const onboarding = async (req, res) => {
  try {
    const { role, institution, fieldOfStudy, country, interests, bio, linkedin, orcid } = req.body;

    const VALID_ROLES = ["researcher", "academic", "professional"];
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "A valid role is required." });
    }

    const user = await SchUser.findByIdAndUpdate(
      req.user.id,
      {
        role,
        institution:    institution    || null,
        fieldOfStudy:   fieldOfStudy   || null,
        country:        country        || null,
        interests:      interests      || [],
        bio:            bio            || null,
        linkedin:       linkedin       || null,
        orcid:          orcid          || null,
        profileComplete: true,
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id:              user._id,
        username:        user.username,
        email:           user.email,
        role:            user.role,
        profileComplete: user.profileComplete,
        myReferralCode:  user.myReferralCode,
      },
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
};