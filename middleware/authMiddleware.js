
// import jwt from "jsonwebtoken";

// const authenticateUser = (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ error: "Unauthorized - Token missing or invalid format" });
//   }

//   const token = authHeader.split(" ")[1];

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Support both token formats:
//     // { id } from generateToken utility
//     // { user, role } from login controller
//     const userId = decoded.id || decoded.user?._id || decoded.user?.id;
//     if (!userId) {
//       return res.status(403).json({ error: "Unauthorized - User ID not found in token" });
//     }

//     req.user = { id: userId, role: decoded.role, ...decoded.user };
//     next();

//   } catch (error) {
//     return res.status(401).json({ error: "Unauthorized - Invalid token" });
//   }
// };

// export default authenticateUser;
import jwt from "jsonwebtoken";

const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized - Token missing or invalid format" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support all token shapes currently in use across the app:
    // { userId, role }  <- register/login
    // { id }            <- generateToken utility, if used elsewhere
    // { user: { _id | id } } <- legacy shape
    const userId = decoded.userId || decoded.id || decoded.user?._id || decoded.user?.id;

    if (!userId) {
      return res.status(403).json({ error: "Unauthorized - User ID not found in token" });
    }

    req.user = { userId, id: userId, role: decoded.role, ...decoded.user };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
};

export default authenticateUser;