import CourseAllocation from
  "../models/CourseAllocation.js";

import Course from
  "../models/Course.js";

import Programme from
  "../models/Programme.js";

import AcademicSession from
  "../models/AcademicSession.js";


/* =====================================================
   ASSIGN COURSE TO STAFF
===================================================== */

// export const assignCourse =
//   async (req, res) => {
//     try {

//       const {
//         staff,
//         course,
//         academicSession,
//       } = req.body;


//       if (
//         !staff ||
//         !course ||
//         !academicSession
//       ) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Staff, course and academic session are required",
//         });
//       }


//       const courseExists =
//         await Course.findById(course);

//       if (!courseExists) {
//         return res.status(404).json({
//           success: false,
//           message:
//             "Course not found",
//         });
//       }


//       const sessionExists =
//         await AcademicSession.findById(
//           academicSession
//         );

//       if (!sessionExists) {
//         return res.status(404).json({
//           success: false,
//           message:
//             "Academic session not found",
//         });
//       }


//       const existingAllocation =
//         await CourseAllocation.findOne({
//           staff,
//           course,
//           academicSession,
//         });

//       if (existingAllocation) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "This course has already been assigned to this staff member",
//         });
//       }


//       const allocation =
//         await CourseAllocation.create({

//           staff,

//           course,

//           programme:
//             courseExists.programme,

//           level:
//             courseExists.level,

//           semester:
//             courseExists.semester,

//           academicSession,

//         });


//       const populatedAllocation =
//         await CourseAllocation.findById(
//           allocation._id
//         )
//           .populate(
//             "staff",
//             "fullName firstName lastName email"
//           )
//           .populate(
//             "course",
//             "code title"
//           )
//           .populate(
//             "programme",
//             "name code"
//           )
//           .populate(
//             "academicSession",
//             "name"
//           );


//       res.status(201).json({
//         success: true,
//         message:
//           "Course assigned successfully",
//         allocation:
//           populatedAllocation,
//       });

//     } catch (error) {

//       res.status(500).json({
//         success: false,
//         message: error.message,
//       });

//     }
//   };


export const assignCourse = async (
  req,
  res
) => {
  try {
    const {
      staff,
      course,
      academicSession,
      status,
    } = req.body;

    if (
      !staff ||
      !course ||
      !academicSession
    ) {
      return res.status(400).json({
        message:
          "Staff, course and academic session are required.",
      });
    }

    /*
      FIND COURSE
    */

    const selectedCourse =
      await Course.findById(course);

    if (!selectedCourse) {
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    /*
      CREATE ALLOCATION

      Programme, level and semester
      automatically come from the course.
    */

    const allocation =
      await CourseAllocation.create({
        staff,
        course,
        programme:
          selectedCourse.programme,
        level:
          selectedCourse.level,
        semester:
          selectedCourse.semester,
        academicSession,
        status:
          status || "Active",
      });

    const populatedAllocation =
      await CourseAllocation.findById(
        allocation._id
      )
        .populate(
          "staff",
          "firstName lastName username email"
        )
        .populate(
          "course",
          "code title"
        )
        .populate(
          "programme",
          "name code"
        )
        .populate(
          "academicSession",
          "name"
        );

    return res.status(201).json({
      message:
        "Course assigned successfully.",
      allocation:
        populatedAllocation,
    });

  } catch (error) {
    console.error(
      "Assign course error:",
      error
    );

    /*
      DUPLICATE ASSIGNMENT
    */

    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "This lecturer has already been assigned to this course for the selected academic session.",
      });
    }

    return res.status(500).json({
      message:
        error.message ||
        "Failed to assign course.",
    });
  }
};
/* =====================================================
   GET ALL COURSE ALLOCATIONS
===================================================== */

// export const getCourseAllocations =
//   async (req, res) => {
//     try {

//       const {
//         staff,
//         programme,
//         course,
//         academicSession,
//         level,
//         semester,
//       } = req.query;

//       const filter = {};

//       if (staff) {
//         filter.staff = staff;
//       }

//       if (programme) {
//         filter.programme = programme;
//       }

//       if (course) {
//         filter.course = course;
//       }

//       if (academicSession) {
//         filter.academicSession =
//           academicSession;
//       }

//       if (level) {
//         filter.level = level;
//       }

//       if (semester) {
//         filter.semester = semester;
//       }


//       const allocations =
//         await CourseAllocation.find(
//           filter
//         )
//           .populate(
//             "staff",
//             "fullName firstName lastName email"
//           )
//           .populate(
//             "course",
//             "code title credits"
//           )
//           .populate(
//             "programme",
//             "name code"
//           )
//           .populate(
//             "academicSession",
//             "name"
//           )
//           .sort({
//             createdAt: -1,
//           });


//       res.status(200).json({
//         success: true,
//         count: allocations.length,
//         allocations,
//       });

//     } catch (error) {

//       res.status(500).json({
//         success: false,
//         message: error.message,
//       });

//     }
//   };

export const getCourseAllocations =
  async (req, res) => {
    try {
      const allocations =
        await CourseAllocation.find()
          .populate(
            "staff",
            "firstName lastName username email"
          )
          .populate(
            "course",
            "code title"
          )
          .populate(
            "programme",
            "name code"
          )
          .populate(
            "academicSession",
            "name"
          )
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        allocations,
      });

    } catch (error) {
      console.error(
        "Get allocations error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch course allocations.",
      });
    }
  };
/* =====================================================
   UPDATE COURSE ALLOCATION
===================================================== */


/* =====================================================
   GET COURSE ALLOCATIONS FOR LOGGED-IN STAFF
===================================================== */

export const getMyCourseAllocations = async (req, res) => {
  try {
    /*
      Depending on your authenticateUser middleware,
      the logged-in user's ID may be stored as:

      req.user.id
      req.user._id
      req.user.userId

      We support all three.
    */

    const staffId =
      req.user?.id ||
      req.user?._id ||
      req.user?.userId;

    if (!staffId) {
      return res.status(401).json({
        success: false,
        message: "Unable to identify logged-in staff.",
      });
    }

    const allocations = await CourseAllocation.find({
      staff: staffId,
      status: "Active",
    })
      .populate(
        "course",
        "code title credits"
      )
      .populate(
        "programme",
        "name code"
      )
      .populate(
        "academicSession",
        "name"
      )
      .populate(
        "staff",
        "firstName lastName username email"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: allocations.length,
      allocations,
    });

  } catch (error) {
    console.error(
      "Get my course allocations error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch your course allocations.",
    });
  }
};

export const getCourseAllocationById = async (req, res) => {
  try {
    const { id } = req.params;

    const allocation = await CourseAllocation.findById(id)
      .populate("staff")
      .populate("course")
      .populate("programme")
      .populate("academicSession");

    if (!allocation) {
      return res.status(404).json({
        message: "Course allocation not found",
      });
    }

    return res.status(200).json({
      allocation,
    });

  } catch (error) {
    console.error("Get course allocation error:", error);

    return res.status(500).json({
      message: "Failed to load course allocation",
      error: error.message,
    });
  }
};
export const updateCourseAllocation =
  async (req, res) => {
    try {

      const allocation =
        await CourseAllocation.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        )
          .populate(
            "staff",
            "fullName firstName lastName email"
          )
          .populate(
            "course",
            "code title"
          )
          .populate(
            "programme",
            "name code"
          )
          .populate(
            "academicSession",
            "name"
          );


      if (!allocation) {
        return res.status(404).json({
          success: false,
          message:
            "Course allocation not found",
        });
      }


      res.status(200).json({
        success: true,
        message:
          "Course allocation updated successfully",
        allocation,
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: error.message,
      });

    }
  };


/* =====================================================
   DELETE COURSE ALLOCATION
===================================================== */

export const deleteCourseAllocation =
  async (req, res) => {
    try {

      const allocation =
        await CourseAllocation.findByIdAndDelete(
          req.params.id
        );

      if (!allocation) {
        return res.status(404).json({
          success: false,
          message:
            "Course allocation not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Course allocation deleted successfully",
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: error.message,
      });

    }
  };