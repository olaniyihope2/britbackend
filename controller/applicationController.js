import mongoose from "mongoose";
import Application from "../models/applicationModel.js";

// Students: view their own application(s)
export const getMyApplications = async (req, res) => {
  try {
const applications = await Application.find({ user: req.user.userId })
  .populate("session", "name currentSemester")
  .populate("programme", "name programmeName title code")
  .sort({ createdAt: -1 })
  .exec();

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("Error fetching my applications:", error);
    return res.status(500).json({ error: "Failed to get applications" });
  }
};

// Students: view a single application by ID (must be their own)
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

const application = await Application.findOne({
  _id: id,
  user: req.user.userId,
})
  .populate("session", "name currentSemester")
  .populate("programme", "name programmeName title code")
  .exec();

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    return res.status(200).json({ application });
  } catch (error) {
    console.error("Error fetching application:", error);
    return res.status(500).json({ error: "Failed to get application" });
  }
};

// Admin: list all applications, optionally filtered by session/status
// export const getAllApplications = async (req, res) => {
//   try {
//     const { sessionId, status } = req.query;
//     const filter = {};
//     if (sessionId) filter.session = sessionId;
//     if (status) filter.status = status;

//   const applications = await Application.find(filter)
//   .populate("user", "username studentName email phone")
//   .populate("session", "name currentSemester")
//   .populate("programme", "name programmeName title code")
//   .sort({ createdAt: -1 })
//   .exec();

//     return res.status(200).json({ applications });
//   } catch (error) {
//     console.error("Error fetching applications:", error);
//     return res.status(500).json({ error: "Failed to get applications" });
//   }
// };
export const getAllApplications = async (req, res) => {
  try {
    const { sessionId, status } = req.query;

    const filter = {};

    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({
          error: "Invalid session ID",
        });
      }

      filter.session = sessionId;
    }

    if (status) {
      if (
        !["Pending", "Submitted", "Approved", "Rejected"].includes(
          status
        )
      ) {
        return res.status(400).json({
          error: "Invalid application status",
        });
      }

      filter.status = status;
    }

    const applications = await Application.find(filter)
      .populate("user", "username studentName email phone address")
      .populate("session", "name currentSemester")
      .populate(
        "programme",
        "name programmeName title code"
      )
      .sort({ createdAt: -1 })
      .exec();

    return res.status(200).json({
      applications,
    });
  } catch (error) {
    console.error(
      "Error fetching applications:",
      error
    );

    return res.status(500).json({
      error: "Failed to get applications",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};
// Admin: approve or reject an application
export const reviewApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    if (!["Submitted", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const application = await Application.findByIdAndUpdate(
      id,
      {
        status,
        reviewNotes,
        reviewedBy: req.user.userId,
        reviewedAt: new Date(),
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    return res.status(200).json({ application });
  } catch (error) {
    console.error("Error reviewing application:", error);
    return res.status(500).json({ error: "Failed to review application" });
  }
};

// Mark application fee as paid (call this from your payment webhook/handler)
export const markApplicationFeePaid = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findByIdAndUpdate(
      id,
      { applicationFeePaid: true, applicationFeePaidAt: new Date() },
      { new: true }
    );
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.status(200).json({ application });
  } catch (error) {
    console.error("Error marking application fee paid:", error);
    return res.status(500).json({ error: "Failed to update payment" });
  }
};

// Mark acceptance fee as paid
export const markAcceptanceFeePaid = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findByIdAndUpdate(
      id,
      { acceptanceFeePaid: true, acceptanceFeePaidAt: new Date() },
      { new: true }
    );
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.status(200).json({ application });
  } catch (error) {
    console.error("Error marking acceptance fee paid:", error);
    return res.status(500).json({ error: "Failed to update payment" });
  }
};