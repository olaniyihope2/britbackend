import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ROLES = ["researcher", "academic", "professional"];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ["researcher", "academic", "professional", null],
        message: "Role must be one of: researcher, academic, professional",
      },
      required: false,
      default: null,
    },
    institution: {
      type: String,
      trim: true,
      default: null,
    },
    fieldOfStudy: {
      type: String,
      trim: true,
      default: null,
    },
    country: {
      type: String,
      trim: true,
      default: null,
    },
    interests: {
      type: [String],
      default: [],
    },
    bio: {
      type: String,
      trim: true,
      default: null,
    },
    linkedin: {
      type: String,
      trim: true,
      default: null,
    },
    orcid: {
      type: String,
      trim: true,
      default: null,
    },
    referralCode: {
      type: String,
      trim: true,
      default: null,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchUser",
      default: null,
    },
    myReferralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    profileComplete: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }

  if (!this.myReferralCode) {
    this.myReferralCode = generateReferralCode(this.username);
  }

  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

function generateReferralCode(username) {
  const prefix = username.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${suffix}`;
}

const User = mongoose.model("SchUser", userSchema);
export default User;