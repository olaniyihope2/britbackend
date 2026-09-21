// services/feeService.js
import Payment from "../models/FeePayment.js";
import { HttpError } from "../utils/studentContext.js";

/* =====================================================
   FEE SCHEDULE  (amounts in Naira)
===================================================== */

// Tuition per semester, by study mode (home students)
const TUITION_PER_SEMESTER = {
  "full-time": 80000,
  "part-time": 60000,
};

// At least this share of tuition must be paid before registration
const MIN_TUITION_SHARE = 0.5;

/*
  scope "once"     = paid one time only, ever
  scope "semester" = paid every semester
  newOnly          = only students with isNewStudent = true

  If the Application Form fee is collected in your application portal and
  not through this system, delete the APPLICATION line below, otherwise
  new students will be blocked until it is paid here.
*/
const ONE_OFF_FEES = [
  { code: "APPLICATION", title: "Application Form", amount: 5000 },
  { code: "ACCEPTANCE", title: "Acceptance Fee", amount: 40000 },
  { code: "ID_CARD", title: "Digital ID Card", amount: 5000 },
];

// Mandatory per-semester fees. Student Handbook is free, so it is left out.
const SEMESTER_FEES = [
  { code: "MEDICAL", title: "Medical", amount: 10000 },
  { code: "EXAMINATION", title: "Examination", amount: 10000 },
  { code: "CAUTION", title: "Caution", amount: 5000 },
  { code: "DIGITAL_LIBRARY", title: "Digital Library & eBooks", amount: 10000 },
  { code: "TECHNOLOGY", title: "Technology & Internet", amount: 10000 },
  { code: "LABORATORY", title: "Laboratory, Workshop & Studio", amount: 15000 },
];

/* =====================================================
   STATUS FOR ONE STUDENT
===================================================== */

const sumOf = (payments) => payments.reduce((total, p) => total + p.amount, 0);

const statusLabel = ({ waived, balance, requiredNow, paid }) => {
  if (waived) return "Waived";
  if (balance === 0) return "Paid";
  if (requiredNow === 0) return "Cleared"; // enough paid, balance still open
  return paid > 0 ? "Part paid" : "Unpaid";
};

/*
  Returns every fee that applies to the student, what they have paid, and
  whether they have paid enough to register courses.
*/
export const getFeeStatus = async (student, session) => {
  if (student.isInternational) {
    throw new HttpError(
      400,
      "International student fees are handled by the bursary office."
    );
  }

  const payments = await Payment.find({
    student: student._id,
    status: "success",
  });

  const paidFor = (code, scope) =>
    sumOf(
      payments.filter(
        (p) =>
          p.feeCode === code &&
          (scope === "once" ||
            (p.session === session.name && p.semester === session.semester))
      )
    );

  const makeItem = ({ code, title, due, scope, requiredShare = 1 }) => {
    const paid = paidFor(code, scope);
    const balance = Math.max(due - paid, 0);
    const minimum = Math.ceil(due * requiredShare);
    const requiredNow = Math.max(minimum - paid, 0);
    const waived = due === 0;

    return {
      code,
      title,
      scope,
      due,
      paid,
      balance,
      requiredNow,
      partPayment: requiredShare < 1,
      status: statusLabel({ waived, balance, requiredNow, paid }),
    };
  };

  const items = [];

  // 1. One-off fees for new students
  if (student.isNewStudent) {
    for (const fee of ONE_OFF_FEES) {
      items.push(
        makeItem({ code: fee.code, title: fee.title, due: fee.amount, scope: "once" })
      );
    }
  }

  // 2. Tuition (scholarships reduce it; part payment allowed)
  const baseTuition =
    TUITION_PER_SEMESTER[student.studyMode] ?? TUITION_PER_SEMESTER["full-time"];

  const share =
    student.scholarship === "full" ? 0 : student.scholarship === "half" ? 0.5 : 1;

  items.push(
    makeItem({
      code: "TUITION",
      title: "Tuition Fee",
      due: baseTuition * share,
      scope: "semester",
      requiredShare: MIN_TUITION_SHARE,
    })
  );

  // 3. Mandatory semester fees
  for (const fee of SEMESTER_FEES) {
    items.push(
      makeItem({ code: fee.code, title: fee.title, due: fee.amount, scope: "semester" })
    );
  }

  return {
    items,
    eligible: items.every((item) => item.requiredNow === 0),
    outstandingNow: items.reduce((total, item) => total + item.requiredNow, 0),
  };
};
