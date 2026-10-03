import mongoose from "mongoose";
import CourseMaterial from "../models/CourseMaterial.js";
import CourseAllocation from "../models/CourseAllocation.js";
import { uploadToS3, deleteFromS3, getDownloadUrl } from "../utils/s3.js";
import Course from "../models/Course.js";
import CourseRegistration from "../models/CourseRegistration.js";
const FOLDER = "course-materials";

const loadAllocation = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return CourseAllocation.findById(id);
};

// The assigned lecturer (or an admin) may manage materials
const canManage = (allocation, req) =>
  req.isAdmin || String(allocation.staff) === String(req.user.userId);

/* ------------------------------------------------------------------ */
/* CREATE                                                              */
/* ------------------------------------------------------------------ */
export const createMaterial = async (req, res) => {
  try {
    const { allocationId, title, description, category } = req.body;

    if (!req.file) return res.status(400).json({ message: "File is required" });
    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

    const allocation = await loadAllocation(allocationId);
    if (!allocation)
      return res.status(404).json({ message: "Course allocation not found" });

    if (!canManage(allocation, req))
      return res.status(403).json({ message: "This course is not assigned to you" });

    // Validate first, upload last, so failed requests leave no orphan files
    const fileKey = await uploadToS3(req.file, FOLDER);

    const material = await CourseMaterial.create({
      allocation: allocation._id,
      course: allocation.course,
      uploadedBy: req.user.userId,
      title: title.trim(),
      description: description?.trim() || "",
      category,
      originalName: req.file.originalname,
      fileKey,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    return res.status(201).json({ message: "Material uploaded", material });
  } catch (error) {
    console.error("Create material error:", error);
    return res.status(500).json({ message: error.message || "Failed to upload material" });
  }
};

/* ------------------------------------------------------------------ */
/* LIST (by allocation)                                                */
/* ------------------------------------------------------------------ */
export const getMaterialsByAllocation = async (req, res) => {
  try {
    const allocation = await loadAllocation(req.params.allocationId);
    if (!allocation)
      return res.status(404).json({ message: "Course allocation not found" });

    if (!canManage(allocation, req))
      return res.status(403).json({ message: "This course is not assigned to you" });

    const materials = await CourseMaterial.find({ allocation: allocation._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({ materials });
  } catch (error) {
    console.error("Get materials error:", error);
    return res.status(500).json({ message: "Failed to load materials" });
  }
};

/* ------------------------------------------------------------------ */
/* UPDATE (details, optionally replace the file)                       */
/* ------------------------------------------------------------------ */
export const updateMaterial = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid material ID" });

    const material = await CourseMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Material not found" });

    const allocation = await CourseAllocation.findById(material.allocation);
    if (!allocation || !canManage(allocation, req))
      return res.status(403).json({ message: "Not allowed" });

    const { title, description, category } = req.body;
    if (title !== undefined && !title.trim())
      return res.status(400).json({ message: "Title cannot be empty" });

    if (title !== undefined) material.title = title.trim();
    if (description !== undefined) material.description = description.trim();
    if (category) material.category = category;

    let oldKey = null;
    if (req.file) {
      oldKey = material.fileKey;
      material.fileKey = await uploadToS3(req.file, FOLDER);
      material.originalName = req.file.originalname;
      material.mimeType = req.file.mimetype;
      material.size = req.file.size;
    }

    await material.save();
    if (oldKey) await deleteFromS3(oldKey); // only after the save succeeds

    return res.status(200).json({ message: "Material updated", material });
  } catch (error) {
    console.error("Update material error:", error);
    return res.status(500).json({ message: error.message || "Failed to update material" });
  }
};

/* ------------------------------------------------------------------ */
/* DELETE                                                              */
/* ------------------------------------------------------------------ */
export const deleteMaterial = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid material ID" });

    const material = await CourseMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Material not found" });

    const allocation = await CourseAllocation.findById(material.allocation);
    if (!allocation || !canManage(allocation, req))
      return res.status(403).json({ message: "Not allowed" });

    await deleteFromS3(material.fileKey);
    await material.deleteOne();

    return res.status(200).json({ message: "Material deleted" });
  } catch (error) {
    console.error("Delete material error:", error);
    return res.status(500).json({ message: "Failed to delete material" });
  }
};

/* ------------------------------------------------------------------ */
/* DOWNLOAD (presigned URL)                                            */
/* ------------------------------------------------------------------ */
export const downloadMaterial = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid material ID" });

    const material = await CourseMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Material not found" });

    const allocation = await CourseAllocation.findById(material.allocation);
    if (!allocation || !canManage(allocation, req))
      return res.status(403).json({ message: "Not allowed" });

    const url = await getDownloadUrl(material.fileKey, material.originalName);
    return res.status(200).json({ url });
  } catch (error) {
    console.error("Download material error:", error);
    return res.status(500).json({ message: "Failed to get download link" });
  }
};

/* ------------------------------------------------------------------ */
/* STUDENT ACCESS                                                      */
/* ------------------------------------------------------------------ */

// ADJUST to match your CourseRegistration schema:
// the student field (here `student`), the `courses` array and the `status` value.
const isRegisteredForCourse = async (userId, courseId) => {
  const registrations = await CourseRegistration.find({
    student: userId,
    status: "Registered",
  }).select("courses");

  return registrations.some((reg) =>
    (reg.courses || []).some(
      (c) => String(c?.course ?? c?._id ?? c) === String(courseId)
    )
  );
};

// List materials for a course the student has registered
export const getMaterialsForStudent = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId))
      return res.status(400).json({ message: "Invalid course ID" });

    if (!(await isRegisteredForCourse(req.user.userId, courseId)))
      return res.status(403).json({ message: "You are not registered for this course" });

    const course = await Course.findById(courseId).select(
      "code title credits level semester"
    );
    if (!course) return res.status(404).json({ message: "Course not found" });

    const allocations = await CourseAllocation.find({
      course: courseId,
      status: "Active",
    }).select("_id");

    // fileKey is deliberately not selected, so students never see S3 keys
    const materials = await CourseMaterial.find({
      allocation: { $in: allocations.map((a) => a._id) },
    })
      .select("title description category originalName mimeType size createdAt uploadedBy")
      .populate("uploadedBy", "firstName lastName name username")
      .sort({ createdAt: -1 });

    return res.status(200).json({ course, materials });
  } catch (error) {
    console.error("Student materials error:", error);
    return res.status(500).json({ message: "Failed to load course materials" });
  }
};

// Presigned download link for a registered student
export const downloadMaterialForStudent = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid material ID" });

    const material = await CourseMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Material not found" });

    const activeAllocation = await CourseAllocation.findOne({
      _id: material.allocation,
      status: "Active",
    }).select("_id");
    if (!activeAllocation)
      return res.status(404).json({ message: "Material is no longer available" });

    if (!(await isRegisteredForCourse(req.user.userId, material.course)))
      return res.status(403).json({ message: "You are not registered for this course" });

    const url = await getDownloadUrl(material.fileKey, material.originalName);
    return res.status(200).json({ url });
  } catch (error) {
    console.error("Student download error:", error);
    return res.status(500).json({ message: "Failed to get download link" });
  }
};