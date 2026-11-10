// Polytechnic grading. Change the scale here if your school uses a different one.
export const CA_MAX = 30;
export const EXAM_MAX = 70;

const GRADE_SCALE = [
  { min: 70, grade: "A", point: 4 },
  { min: 60, grade: "B", point: 3 },
  { min: 50, grade: "C", point: 2 },
  { min: 45, grade: "D", point: 1 },
  { min: 0, grade: "F", point: 0 },
];

export const gradeFor = (total) => GRADE_SCALE.find((g) => total >= g.min);

// Weighted average: sum(units × point) / sum(units).
// Works for one course list, one semester, one session, or all sessions.
export const computeGPA = (rows) => {
  const units = rows.reduce((sum, r) => sum + (r.creditUnits || 0), 0);
  const points = rows.reduce(
    (sum, r) => sum + (r.creditUnits || 0) * (r.gradePoint || 0),
    0
  );
  return {
    units,
    points,
    gpa: units ? Math.round((points / units) * 100) / 100 : 0,
  };
};