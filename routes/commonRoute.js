import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import {
  login,
  register,
  getUserByRole,
  getStudentById,
  getStudentByIdBySession,
  getStudentsBySession,
  getStudentsByProgramme,
  getStaffById,
  updateStaffById,
  getAdmin,
  getAdminById,
  updateAdmin,
  updateStudentById,
  deleteUser,
  deleteUserFromSpecificSession,
  createSetting,
  getSetting,
  createAccount,
  getAccountSetting,
  getMe,
  addSessionToUsersWithoutSession,
  addSessionToDownloadWithoutSession,
  addAnotherSessionToUserWithSession,
  updatePasswords,
  promoteStudents,
  getAllStaff,
   registerStaff
} from "../controller/authController.js";
import {
  createDownload,
  deleteDownload,
  getDownload,
  getDownloadbyClass,
} from "../controller/downloadController.js";
import {
  createBook,
  getBook,
  getBookById,
} from "../controller/bookController.js";
import authenticateUser from "../middleware/authMiddleware.js";

const commonRoute = (s3) => {
  const router = express.Router();

  const upload = multer({
    storage: multerS3({
      s3,
      bucket: "edupros",
      acl: "public-read",
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      },
    }),
    limits: { fileSize: 500 * 1024 * 1024 },
  });

  // auth
  router.post("/register", register);
  router.post("/login", login);
  router.post("/update-passwords", updatePasswords);
router.post(
  "/staff/register",
  authenticateUser,
  // authorize("admin"),
  registerStaff
);
  // lookups
  router.get("/users/:role/:sessionId", getUserByRole);
  router.get("/students/:id", authenticateUser, getStudentById);
  router.get("/get-students/:id/:sessionId", authenticateUser, getStudentByIdBySession);
  router.get("/students-session/:sessionId", authenticateUser, getStudentsBySession);
  router.get(
    "/students-programme/:programme/:level/:sessionId",
    authenticateUser,
    getStudentsByProgramme
  );
  router.get("/staff", authenticateUser, getAllStaff);
  router.get("/me", authenticateUser, getMe);
  router.get("/staff/:id", authenticateUser, getStaffById);
  router.get("/get-admin/:id", authenticateUser, getAdminById);
  router.get("/get-session-admin/:sessionId", authenticateUser, getAdmin);

  // updates
  router.put("/admin/:id", authenticateUser, updateAdmin);
  router.put("/staff/:id", authenticateUser, updateStaffById);
  router.put("/put-students/:id", authenticateUser, updateStudentById);

  // deletes
  router.delete("/users/:userId", deleteUser);
  router.delete("/session/:sessionId/users/:userId", deleteUserFromSpecificSession);

  // session/bulk migration
  router.post("/addSessionToUsersWithoutSession", addSessionToUsersWithoutSession);
  router.post("/addSessionToDownloadWithoutSession", addSessionToDownloadWithoutSession);
  router.post("/addAnotherSessionToUserWithSession", addAnotherSessionToUserWithSession);
  router.post("/promote", promoteStudents);

  // settings / account / uploads
  router.post("/setting", upload.single("signature"), createSetting);
  router.post("/account-setting", upload.single("schoolLogo"), (req, res) =>
    createAccount(req, res, s3)
  );
  router.post("/download", upload.single("Downloads"), (req, res) =>
    createDownload(req, res, s3)
  );
  router.post(
    "/book",
    upload.fields([{ name: "Download" }, { name: "imageUrl" }]),
    (req, res) => createBook(req, res, s3)
  );

  router.get("/setting", getSetting);
  router.get("/download/:sessionId", getDownload);
  router.get("/downloaded/:sessionId/:className", getDownloadbyClass);
  router.get("/book", getBook);
  router.get("/book/:id", getBookById);
  router.get("/account-setting", getAccountSetting);
  router.delete("/download/:sessionId/:downloadId", deleteDownload);

  return router;
};

export default commonRoute;