import Course from "../models/Course.js";
import Department from "../models/Department.js";


/* =====================================================
   CREATE COURSE
===================================================== */

export const createCourse = async (req, res) => {
  try {

    const {
      code,
      title,
      department,  // ✅ CHANGED: programme → department
      level,
      semester,
      credits,
      type,
      status,
    } = req.body;

    // ✅ FIXED: Now validating the right variable
    if (!code || !title || !department || !level || !semester) {
      return res.status(400).json({
        success: false,
        message:
          "Code, title, department, level and semester are required",  // ✅ CHANGED: programme → department
      });
    }

    // ✅ CHANGED: Programme → Department
    const departmentExists =
      await Department.findById(department);

    if (!departmentExists) {
      return res.status(404).json({
        success: false,
        message: "Department not found",  // ✅ CHANGED: Programme → Department
      });
    }

    // ✅ CHANGED: programme → department
    const existingCourse =
      await Course.findOne({
        code: code.toUpperCase(),
        department,  // ✅ CHANGED: programme → department
        level,
        semester,
      });

    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message:
          "This course already exists for this department, level and semester",  // ✅ CHANGED: programme → department
      });
    }

    // ✅ department is now properly defined
    const course =
      await Course.create({
        code: code.toUpperCase(),
        title,
        department,
        level,
        semester,
        credits,
        type,
        status,
      });

    const populatedCourse =
      await Course.findById(course._id)
        .populate("department", "name code qualification");

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: populatedCourse,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   GET ALL COURSES
===================================================== */

export const getCourses = async (req, res) => {
  try {

    const {
     
      department,
      level,
      semester,
      status,
    } = req.query;

    const filter = {};

  

    if (department) {
      filter.department = department;
    }

    if (level) {
      filter.level = level;
    }

    if (semester) {
      filter.semester = semester;
    }

    if (status) {
      filter.status = status;
    }

    const courses =
      await Course.find(filter)
      
        .populate(
          "department",
          "name code qualification"
        )
        .sort({
          level: 1,
          semester: 1,
          code: 1,
        });

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   GET SINGLE COURSE
===================================================== */

export const getCourse = async (req, res) => {
  try {

    const course =
      await Course.findById(req.params.id)
      
        .populate(
          "department",
          "name code qualification"
        );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      course,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   UPDATE COURSE
===================================================== */

export const updateCourse = async (req, res) => {
  try {

    const course =
      await Course.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      )
      
        .populate(
          "department",
          "name code qualification"
        );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Course updated successfully",
      course,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   DELETE COURSE
===================================================== */

export const deleteCourse = async (req, res) => {
  try {

    const course =
      await Course.findByIdAndDelete(
        req.params.id
      );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Course deleted successfully",
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};