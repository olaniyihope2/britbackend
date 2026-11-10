import Application from "../models/applicationModel.js";

const num = (v) => Number(v) || 0;

export const getApplicationGate = async (studentId, _sessionId) => {
  const apps = await Application.find({ user: studentId })
    .sort({ createdAt: -1 })
    .lean();

  // Prefer an approved application; otherwise use the latest one
  const app = apps.find((a) => a.status === "Approved") || apps[0];

  if (!app) {
    return {
      eligible: false,
      reason: "Apply before you can register courses.",
      items: [
        {
          code: "APPLICATION_FEE",
          title: "Application fee",
          due: 0,
          paid: 0,
          balance: 0,
          requiredNow: 0,
          partPayment: false,
          status: "Apply first",
          payable: false,
          applicationId: null,
        },
      ],
      outstanding: 0,
    };
  }

  const appFee = num(app.applicationFee);
  const accFee = num(app.acceptanceFee);
  const appPaid = Boolean(app.applicationFeePaid);
  const accPaid = Boolean(app.acceptanceFeePaid);
  const approved = app.status === "Approved";

  const applicationPayable = !appPaid;
  const acceptancePayable = approved && !accPaid;

  const items = [
    {
      code: "APPLICATION_FEE",
      title: "Application fee",
      due: appFee,
      paid: appPaid ? appFee : 0,
      balance: appPaid ? 0 : appFee,
      requiredNow: applicationPayable ? appFee : 0,
      partPayment: false,
      status: appPaid ? "Paid" : "Unpaid",
      payable: applicationPayable,
      applicationId: String(app._id),
    },
    {
      code: "ACCEPTANCE_FEE",
      title: "Acceptance fee",
      due: accFee,
      paid: accPaid ? accFee : 0,
      balance: accPaid ? 0 : accFee,
      requiredNow: acceptancePayable ? accFee : 0,
      partPayment: false,
      status: accPaid ? "Paid" : approved ? "Unpaid" : "Available after approval",
      payable: acceptancePayable,
      applicationId: String(app._id),
    },
  ];

  let reason = "";
  if (!appPaid) {
    reason = "Pay your application fee before registering courses.";
  } else if (app.status === "Rejected") {
    reason = "Your application was not approved, so you cannot register courses.";
  } else if (!approved) {
    reason = "Your application is still under review. Registration opens after admission is approved.";
  } else if (!accPaid) {
    reason = "Pay your acceptance fee before registering courses.";
  }

  return {
    eligible: !reason,
    reason,
    items,
    outstanding: items.reduce((sum, i) => sum + i.requiredNow, 0),
  };
};