import Department from "../models/Department.js";


/* =====================================================
   CREATE DEPARTMENT
===================================================== */

export const createDepartment = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      status,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Department name and code are required",
      });
    }

    const existingDepartment =
      await Department.findOne({
        $or: [
          { name },
          { code: code.toUpperCase() },
        ],
      });

    if (existingDepartment) {
      return res.status(400).json({
        success: false,
        message:
          "Department with this name or code already exists",
      });
    }

    const department =
      await Department.create({
        name,
        code: code.toUpperCase(),
        description,
        status,
      });

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      department,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   GET ALL DEPARTMENTS
===================================================== */

export const getDepartments = async (req, res) => {
  try {

    const departments =
      await Department.find()
        .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: departments.length,
      departments,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   GET SINGLE DEPARTMENT
===================================================== */

export const getDepartment = async (req, res) => {
  try {

    const department =
      await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      department,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   UPDATE DEPARTMENT
===================================================== */

export const updateDepartment = async (req, res) => {
  try {

    const department =
      await Department.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      department,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   DELETE DEPARTMENT
===================================================== */

export const deleteDepartment = async (req, res) => {
  try {

    const department =
      await Department.findByIdAndDelete(
        req.params.id
      );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Department deleted successfully",
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};