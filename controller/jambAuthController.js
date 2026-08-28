import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import Auth from "../models/authModel.js";
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_AUTH_REDIRECT_URI
);

export const signUp = async (req, res) => {
  const { fullname, username, email, phone, password } = req.body;

  if (!fullname || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Fullname, email, and password are required",
    });
  }

  try {
    const existingUser = await Auth.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await Auth.create({
      fullname,
      username,
      email,
      phone,
      password: hashedPassword,
    });

    // Create tokens
    const accessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
        username: user.username,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, message: "Signup failed" });
  }
};

// export const login = async (req, res, next) => {
//   const { email, password, googleToken } = req.body;

//   try {
//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     if (googleToken) {
//       const ticket = await oauth2Client.verifyIdToken({
//         idToken: googleToken,
//         audience: process.env.GOOGLE_CLIENT_ID,
//       });
//       const payload = ticket.getPayload();

//       if (user.googleId !== payload.sub) {
//         return res.status(401).json({ message: "Invalid Google token" });
//       }

//       // const token = jwt.sign(
//       //   { id: user._id, isAdmin: user.isAdmin },
//       //   process.env.JWT_SECRET,
//       //   { expiresIn: "1h" }
//       // );
//       const token = jwt.sign(
//         { userId: user._id, isAdmin: user.isAdmin }, // Change `id` to `userId`
//         process.env.JWT_SECRET,
//         { expiresIn: "1h" }
//       );

//       res.status(200).json({
//         accessToken: user.accessToken,
//         refreshToken: user.refreshToken,
//         token,
//         user,
//       });
//     } else {
//       const isPasswordValid = await bcrypt.compare(password, user.password);
//       if (!isPasswordValid) {
//         return res.status(401).json({ message: "Invalid password" });
//       }

//       const token = jwt.sign(
//         { id: user._id, isAdmin: user.isAdmin },
//         process.env.JWT_SECRET,
//         { expiresIn: "1h" }
//       );

//       res.status(200).json({
//         accessToken: user.accessToken,
//         refreshToken: user.refreshToken,
//         token,
//         user,
//       });
//     }
//   } catch (error) {
//     next(error);
//   }
// };

export const login = async (req, res) => {
  const { email, password, googleToken } = req.body;

  try {
    const user = await Auth.findOne({ email }).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!googleToken) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid password" });
      }
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
        username: user.username,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
};

export const getProfile = async (req, res) => {
  try {
    console.log("Profile Request Received. User in Request:", req.user);

    if (!req.user) {
      return res
        .status(401)
        .json({ message: "User not found or token invalid" });
    }

    // const user = await User.findById(req.user.userId).select("-password");
    const user = await Auth.findById(req.user._id).select("-password");

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const forgotPassword = (req, res) => {
  // Handle forgot password
  // You can implement email sending logic here
  res.send("Password reset link sent!");
};
