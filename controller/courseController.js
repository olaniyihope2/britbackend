import Course from "../models/Course.js";
import Programme from "../models/Programme.js";


/* =====================================================
   CREATE COURSE
===================================================== */

export const createCourse = async (req, res) => {
  try {

    const {
      code,
      title,
      programme,
      level,
      semester,
      credits,
      type,
      status,
    } = req.body;

    if (
      !code ||
      !title ||
      !programme ||
      !level ||
      !semester
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Code, title, programme, level and semester are required",
      });
    }

    const programmeExists =
      await Programme.findById(programme);

    if (!programmeExists) {
      return res.status(404).json({
        success: false,
        message: "Programme not found",
      });
    }

    const existingCourse =
      await Course.findOne({
        code: code.toUpperCase(),
        programme,
        level,
        semester,
      });

    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message:
          "This course already exists for this programme, level and semester",
      });
    }

    const course =
      await Course.create({
        code: code.toUpperCase(),

        title,

        programme,

        department:
          programmeExists.department,

        level,

        semester,

        credits,

        type,

        status,
      });

    const populatedCourse =
      await Course.findById(course._id)
        .populate(
          "programme",
          "name code qualification"
        )
        .populate(
          "department",
          "name code"
        );

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
      programme,
      department,
      level,
      semester,
      status,
    } = req.query;

    const filter = {};

    if (programme) {
      filter.programme = programme;
    }

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
          "programme",
          "name code qualification"
        )
        .populate(
          "department",
          "name code"
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
          "programme",
          "name code qualification"
        )
        .populate(
          "department",
          "name code"
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
          "programme",
          "name code qualification"
        )
        .populate(
          "department",
          "name code"
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