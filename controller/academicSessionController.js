import AcademicSession from
  "../models/AcademicSession.js";


export const createAcademicSession =
  async (req, res) => {
    try {

      const {
        name,
        startDate,
        endDate,
        status,
      } = req.body;

      if (
        !name ||
        !startDate ||
        !endDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name, start date and end date are required",
        });
      }

      /*
        Only one academic session should be active.
      */

      if (status === "Active") {
        await AcademicSession.updateMany(
          {
            status: "Active",
          },
          {
            status: "Completed",
          }
        );
      }

      const session =
        await AcademicSession.create({
          name,
          startDate,
          endDate,
          status,
        });

      res.status(201).json({
        success: true,
        message:
          "Academic session created successfully",
        session,
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: error.message,
      });

    }
  };


export const getAcademicSessions =
  async (req, res) => {
    try {

      const sessions =
        await AcademicSession.find()
          .sort({
            startDate: -1,
          });

      res.status(200).json({
        success: true,
        count: sessions.length,
        sessions,
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: error.message,
      });

    }
  };


export const updateAcademicSession =
  async (req, res) => {
    try {

      const {
        status,
      } = req.body;

      if (status === "Active") {

        await AcademicSession.updateMany(
          {
            _id: {
              $ne: req.params.id,
            },
            status: "Active",
          },
          {
            status: "Completed",
          }
        );

      }

      const session =
        await AcademicSession.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        );

      if (!session) {
        return res.status(404).json({
          success: false,
          message:
            "Academic session not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Academic session updated successfully",
        session,
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: error.message,
      });

    }
  };


export const deleteAcademicSession =
  async (req, res) => {
    try {

      const session =
        await AcademicSession.findByIdAndDelete(
          req.params.id
        );

      if (!session) {
        return res.status(404).json({
          success: false,
          message:
            "Academic session not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Academic session deleted successfully",
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        message: error.message,
      });

    }
  };