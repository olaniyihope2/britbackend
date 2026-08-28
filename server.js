import express from "express";
import dotenv from "dotenv";
import { S3 } from "@aws-sdk/client-s3";
import cors from "cors";
import path from "path";
import classRoute from "./routes/classRoute.js";
import jambAuthRoute from "./routes/jambAuthRoute.js";
import adRoutes from "./routes/adRoutes.js";
import aiRoute from "./routes/aiRoute.js";
import examlistRoute from "./routes/examlistRoute.js";
import jambRoute from "./routes/jambRoute.js";
import gradeRoute from "./routes/gradeRoute.js";
import pinRoute from "./routes/pinRoute.js";
import schPaymentRoute from "./routes/schPaymentRoute.js";
import applicationRoute from "./routes/applicationRoute.js";
import subscriptionRoutes from "./routes/subscriptionRoute.js";
import activationRoute from "./routes/activationRoute.js";
import catRoute from "./routes/catRoute.js";
import stuRoute from "./routes/stuRoute.js";
import FibroidRoute from "./routes/FibroidRoute.js";
import teRoute from "./routes/teRoute.js";
import parentRoute from "./routes/parentRoute.js";
import commonRoute from "./routes/commonRoute.js";
import questionRoute from "./routes/questionRoute.js";
import jambsubjectRoute from "./routes/jambsubjectRoute.js";
import examRoute from "./routes/examRoute.js";
import jambsubmitRoute from "./routes/jambsubmitRoute.js";
import subRoute from "./routes/subRoute.js";
import markRoute from "./routes/markRoute.js";
import offlineRoute from "./routes/offlineRoute.js";
import OffRoutes from "./routes/OffRoutes.js";
import psyRoute from "./routes/psyRoute.js";
import receiptRoute from "./routes/receiptRoute.js";
import onScreenRoute from "./routes/onScreenRoute.js";
import innovateRoute from "./routes/innovateRoute.js";
import noticeRoute from "./routes/noticeRoute.js";
import sessionRoute from "./routes/sessionRoute.js";
import schRoute from "./routes/schRoute.js";
import bulkStudentRoute from "./routes/bulkStudentRoute.js";
import homeworkRoute from "./routes/homeworkRoute.js";
import practicePqRoutes from "./routes/practicePqRoutes.js";
import authenticateUser from "./middleware/authMiddleware.js";
import connectDB from "./config/db2.js";
import departmentRoutes from
  "./routes/departmentRoutes.js";

import programmeRoutes from
  "./routes/programmeRoutes.js";

import courseRoutes from
  "./routes/courseRoutes.js";


import courseAllocationRoutes from
  "./routes/courseAllocationRoutes.js";

dotenv.config();
const app = express();
connectDB();

const s3 = new S3({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const corsOptions = {
  origin: [
    "http://localhost:3001",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:8082",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:8081",
    "https://portal.britcampus.com"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use((err, req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next(err);
});

const authRoutes = [
  { method: "get", path: "/students/:id", middleware: authenticateUser },
  { method: "get", path: "/teachers/:id", middleware: authenticateUser },
  { method: "get", path: "/get-session-admin/:sessionId", middleware: authenticateUser },
  { method: "put", path: "/students/:id", middleware: authenticateUser },
  { method: "put", path: "/teachers/:id", middleware: authenticateUser },
];

const commonRouterWithAuth = commonRoute(s3, authRoutes);
const onScreen = onScreenRoute(s3);
app.use(
  "/api/departments",
  departmentRoutes
);

app.use(
  "/api/programmes",
  programmeRoutes
);

app.use(
  "/api/courses",
  courseRoutes
);


app.use(
  "/api/course-allocations",
  courseAllocationRoutes
);
app.use("/api/", offlineRoute);
app.use("/api/ad", adRoutes);
app.use("/api/", examlistRoute);
app.use("/api/", jambRoute);
app.use("/api/", noticeRoute);
app.use("/api/auth", jambAuthRoute);
app.use("/api/", innovateRoute);
app.use("/api/", OffRoutes);
app.use("/api/", receiptRoute);
app.use("/api", commonRouterWithAuth);
app.use("/api/", schRoute);
app.use("/api/", applicationRoute);
app.use("/api/", aiRoute);
app.use("/api/", pinRoute);
app.use("/api/", activationRoute);
app.use("/api/", jambsubmitRoute);
app.use("/api/divine", FibroidRoute);
app.use("/api/", classRoute);
app.use("/api/", bulkStudentRoute);
app.use("/api/sessions", sessionRoute);
app.use("/api/", homeworkRoute);
app.use("/api/onScreen", onScreen);
app.use("/api", schPaymentRoute);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/", gradeRoute);
app.use("/api/", catRoute);
app.use("/api/mark", markRoute);
app.use("/api/", stuRoute);
app.use("/api/", teRoute);
app.use("/api/", parentRoute);
app.use("/api/", subRoute);
app.use("/api/", questionRoute);
app.use("/api/jamb", jambsubjectRoute);
app.use("/api/", examRoute);
app.use("/api/", psyRoute);
app.use("/api/", practicePqRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
