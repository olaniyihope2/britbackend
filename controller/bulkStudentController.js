import bcrypt from "bcryptjs";
import XLSX from "xlsx";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";

const REQUIRED_FIELDS = [
  "username",
  "classname",
  "email",
  "parentsname",
  "phone",
  "birthday",
  "address",
  "admno",
  "password",
  "studentname",
];

function normalizeKey(key = "") {
  return String(key).trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizeRow(row = {}) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[normalizeKey(key)] = typeof value === "string" ? value.trim() : value;
  });
  return normalized;
}

function parseWorksheet(buffer, filename = "students.xlsx") {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
}

export const bulkUploadStudents = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can bulk upload students." });
    }

    const { sessionId } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: "Upload a CSV or Excel file." });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(400).json({ message: "Invalid session ID." });
    }

    const rawRows = parseWorksheet(req.file.buffer, req.file.originalname);
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ message: "The uploaded file has no student rows." });
    }

    const rows = rawRows.map(normalizeRow);
    const firstRowKeys = Object.keys(rows[0] || {});
    const missingFields = REQUIRED_FIELDS.filter((field) => !firstRowKeys.includes(field));
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "The file is missing required student columns.",
        missingFields,
      });
    }

    const results = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      if (!row.username || !row.password || !row.studentname || !row.classname) {
        results.push({
          row: rowNumber,
          status: "failed",
          reason: "Required values are missing in this row.",
        });
        continue;
      }

      const existingUser = await User.findOne({ username: row.username }).lean();
      if (existingUser) {
        results.push({
          row: rowNumber,
          status: "skipped",
          reason: `Username "${row.username}" already exists.`,
        });
        continue;
      }

      const password = await bcrypt.hash(String(row.password), 10);
      const student = new User({
        role: "student",
        username: row.username,
        classname: row.classname,
        email: row.email,
        parentsName: row.parentsname,
        phone: row.phone,
        birthday: row.birthday ? new Date(row.birthday) : undefined,
        address: row.address,
        AdmNo: row.admno,
        password,
        studentName: row.studentname,
        session: sessionId,
      });

      await student.save();
      results.push({
        row: rowNumber,
        status: "created",
        username: row.username,
      });
    }

    return res.status(201).json({
      message: "Bulk upload completed.",
      summary: {
        total: results.length,
        created: results.filter((item) => item.status === "created").length,
        skipped: results.filter((item) => item.status === "skipped").length,
        failed: results.filter((item) => item.status === "failed").length,
      },
      results,
      requiredFields: REQUIRED_FIELDS,
    });
  } catch (error) {
    console.error("bulkUploadStudents error:", error);
    return res.status(500).json({ message: "Bulk student upload failed." });
  }
};
