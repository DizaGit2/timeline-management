import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import employeeRoutes from "./routes/employee";
import scheduleRoutes from "./routes/schedule";
import shiftRoutes from "./routes/shift";
import availabilityRoutes, { employeeAvailabilityRouter } from "./routes/availability";
import reportRoutes from "./routes/report";
import notificationRoutes from "./routes/notification";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/employees/:id", employeeAvailabilityRouter);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

export default app;
