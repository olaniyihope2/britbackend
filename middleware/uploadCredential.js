import multer from "multer";

const allowed = ["application/pdf", "image/jpeg", "image/png"];

export const uploadCredentialFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only PDF, JPG or PNG files are allowed")),
}).single("file");