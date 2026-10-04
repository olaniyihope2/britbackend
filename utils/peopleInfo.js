import mongoose from "mongoose";

/* !! ADAPT: model names / field names to your student & staff schemas !! */
const findPeople = async (ids, modelNames) => {
  const found = new Map();
  for (const name of modelNames) {
    const Model = mongoose.models[name];
    if (!Model) continue;
    const missing = ids.filter((id) => !found.has(String(id)));
    if (missing.length === 0) break;
    const docs = await Model.find({ _id: { $in: missing } }).lean();
    docs.forEach((d) => found.set(String(d._id), d));
  }
  return found;
};

const toInfo = (d) => ({
  name:
    `${d.firstName || ""} ${d.lastName || ""}`.trim() || d.name || d.username || "Unknown",
  matric: d.matricNumber || d.matricNo || d.regNumber || d.registrationNumber || "",
  email: d.email || "",
});

export const getStudentInfo = async (ids) => {
  const people = await findPeople(ids, ["Student", "User"]);
  return new Map([...people].map(([id, d]) => [id, toInfo(d)]));
};

export const getStaffInfo = async (ids) => {
  const people = await findPeople(ids, ["Staff", "Lecturer", "User"]);
  return new Map([...people].map(([id, d]) => [id, toInfo(d)]));
};
