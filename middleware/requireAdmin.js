import User from "../models/userModel.js";

const ADMIN_ROLES = ["admin", "superadmin"]; // match the role values in your User model

const checkAdmin = async (req) => {
  // Use the role from the JWT if authenticateUser sets one, otherwise look it up
  const role =
    req.user?.role ??
    (await User.findById(req.user.userId).select("role").lean())?.role;
  return ADMIN_ROLES.includes(String(role).toLowerCase());
};

// Blocks non-admins
export const requireAdmin = async (req, res, next) => {
  try {
    if (!(await checkAdmin(req)))
      return res.status(403).json({ error: "Admins only" });
    req.isAdmin = true;
    next();
  } catch (error) {
    console.error("requireAdmin error:", error);
    res.status(500).json({ error: "Authorization failed" });
  }
};

// Sets req.isAdmin without blocking (for routes the owner can also use)
export const flagAdmin = async (req, _res, next) => {
  try {
    req.isAdmin = await checkAdmin(req);
    next();
  } catch (error) {
    console.error("flagAdmin error:", error);
    res.status(500).json({ error: "Authorization failed" });
  }
};