// Converts "First Semester", "first", "Second Semester" etc. to "First" or "Second"
export const normalizeSemester = (value) => {
  const v = String(value || "").toLowerCase();
  if (v.startsWith("first")) return "First";
  if (v.startsWith("second")) return "Second";
  return null;
};