import Programme from "../models/Programme.js";
import Department from "../models/Department.js";


/* =====================================================
   CREATE PROGRAMME
===================================================== */

export const createProgramme = async (req, res) => {
  try {

    const {
      name,
      code,
      department,
      qualification,
      duration,
      description,
      status,
    } = req.body;

    if (
      !name ||
      !code ||
      !department
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, code and department are required",
      });
    }

    const departmentExists =
      await Department.findById(department);

    if (!departmentExists) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    const existingProgramme =
      await Programme.findOne({
        $or: [
          { name },
          { code: code.toUpperCase() },
        ],
      });

    if (existingProgramme) {
      return res.status(400).json({
        success: false,
        message:
          "Programme with this name or code already exists",
      });
    }

    const programme =
      await Programme.create({
        name,
        code: code.toUpperCase(),
        department,
        qualification,
        duration,
        description,
        status,
      });

    res.status(201).json({
      success: true,
      message:
        "Programme created successfully",
      programme,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   GET ALL PROGRAMMES
===================================================== */

export const getProgrammes = async (req, res) => {
  try {

    const {
      status,
      department,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (department) {
      filter.department = department;
    }

    const programmes =
      await Programme.find(filter)
        .populate(
          "department",
          "name code"
        )
        .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: programmes.length,
      programmes,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   GET SINGLE PROGRAMME
===================================================== */

export const getProgramme = async (req, res) => {
  try {

    const programme =
      await Programme.findById(req.params.id)
        .populate(
          "department",
          "name code"
        );

    if (!programme) {
      return res.status(404).json({
        success: false,
        message: "Programme not found",
      });
    }

    res.status(200).json({
      success: true,
      programme,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   UPDATE PROGRAMME
===================================================== */

export const updateProgramme = async (req, res) => {
  try {

    const programme =
      await Programme.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      ).populate(
        "department",
        "name code"
      );

    if (!programme) {
      return res.status(404).json({
        success: false,
        message: "Programme not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Programme updated successfully",
      programme,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


/* =====================================================
   DELETE PROGRAMME
===================================================== */

export const deleteProgramme = async (req, res) => {
  try {

    const programme =
      await Programme.findByIdAndDelete(
        req.params.id
      );

    if (!programme) {
      return res.status(404).json({
        success: false,
        message: "Programme not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Programme deleted successfully",
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};