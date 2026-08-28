// // seedSession.js
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import Session from "../models/sessionModel.js";

// dotenv.config();

// const run = async () => {
//  await mongoose.connect(process.env.MONGODB_URI);

//   const existing = await Session.findOne({ isActive: true });
//   if (existing) {
//     console.log("Active session already exists:", existing.name);
//     process.exit(0);
//   }

//   const session = await Session.create({
//     name: "2026/2027",
//     startDate: new Date("2026-09-01"),
//     endDate: new Date("2027-07-31"),
//     isActive: true,
//   });

//   console.log("Created active session:", session.name);
//   process.exit(0);
// };

// run().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });
// seedSession.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Session from "../models/sessionModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SESSION_NAME = "2026/2027";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const alreadyActive = await Session.findOne({ isActive: true });
  if (alreadyActive) {
    console.log("Active session already exists:", alreadyActive.name);
    process.exit(0);
  }

  // Make sure only one session is ever active
  await Session.updateMany({}, { isActive: false });

  let session = await Session.findOne({ name: SESSION_NAME });

  if (session) {
    session.isActive = true;
    await session.save();
    console.log("Activated existing session:", session.name);
  } else {
    session = await Session.create({
      name: SESSION_NAME,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-07-31"),
      isActive: true,
    });
    console.log("Created active session:", session.name);
  }

  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});