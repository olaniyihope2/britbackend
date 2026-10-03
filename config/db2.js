// import mongoose from "mongoose";

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log("MongoDB connected.");
//   } catch (error) {
//     console.error(`Error: ${error.message}`);
//     process.exit(1);
//   }
// };

// export default connectDB;
import mongoose from "mongoose";

let listenersAttached = false;

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on("disconnected", () =>
    console.warn("MongoDB disconnected. Waiting to reconnect...")
  );
  mongoose.connection.on("reconnected", () =>
    console.log("MongoDB reconnected.")
  );
  mongoose.connection.on("error", (err) =>
    console.error("MongoDB error:", err.message)
  );
};

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("Error: MONGODB_URI is not set in .env");
    process.exit(1);
  }

  attachListeners();

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,        // replaces the legacy replset monitor that crashed
      serverSelectionTimeoutMS: 15000, // fail fast with a clear error if Atlas is unreachable
      socketTimeoutMS: 45000,
      family: 4,                       // force IPv4; avoids flaky DNS on some networks
    });
    console.log("MongoDB connected.");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;