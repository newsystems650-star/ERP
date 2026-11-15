import express from "express";
import type { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";

// Import routes
import companyRoutes from "./server/api/v1/endpoints/companies.ts";
import cashierRoutes from "./server/api/v1/endpoints/cashier.ts";
import inventoryRoutes from "./server/api/v1/endpoints/inventory.ts";
import woodRoutes from "./server/api/v1/endpoints/wood.ts";
import optimizerRoutes from "./server/api/v1/endpoints/optimizer.ts";
import deliveriesRoutes from "./server/api/v1/endpoints/deliveries.ts";
import adminRoutes from "./server/api/v1/endpoints/admin.ts";
import { createAuthRouter } from "./server/api/v1/endpoints/auth.ts";
import { createAiRouter } from "./server/api/v1/endpoints/ai.ts";
import { cppBridge } from "./server/core/cpp_bridge.ts";

// Security & Bunker Mode State
let bunkerMode = false;
let userErrors: Record<string, number> = {};
const MAX_USER_ERRORS = 3;

const bunkerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (bunkerMode) {
    console.log(`[BUNKER MODE] Request: ${req.method} ${req.url} from ${req.ip}`);
  }
  next();
};

const trackUserError = (userId: string) => {
  userErrors[userId] = (userErrors[userId] || 0) + 1;
  if (userErrors[userId] >= MAX_USER_ERRORS) {
    bunkerMode = true;
    console.error(`🚨 BUNKER MODE ACTIVATED for user ${userId}`);
  }
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable("x-powered-by");
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(bunkerMiddleware);

  // Start C++ Watchdog
  cppBridge.startWatchdog();
  if (cppBridge.getAuditLogs(false).length === 0) {
    await cppBridge.auditLog({ action: "SYSTEM_BOOT", module: "NicCore_ERP" });
  }

  // API Routes
  app.get("/api/v1/health", (req, res) => {
    res.json({
      status: "ok",
      architecture: "Layered + C++ Bridge",
      bunkerMode,
      errorCount: Object.values(userErrors).reduce((a, b) => a + b, 0),
      bridge: cppBridge.getStatus(),
      telegramConfigured: Boolean(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID),
      version: "2.1.0-NicCore",
    });
  });

  app.post("/api/v1/admin/bunker/simulate", async (req, res) => {
    const userId = String(req.body?.userId || "operator_session");
    for (let i = 0; i < MAX_USER_ERRORS; i++) {
      trackUserError(userId);
    }
    await cppBridge.auditLog({ action: "BUNKER_MODE_ACTIVATED", userId });
    res.json({ status: "bunker_activated", bunkerMode });
  });

  app.post("/api/v1/admin/bunker/deactivate", async (req, res) => {
    bunkerMode = false;
    userErrors = {};
    await cppBridge.auditLog({ action: "BUNKER_MODE_DEACTIVATED" });
    res.json({ status: "bunker_deactivated", bunkerMode });
  });

  app.use("/api/v1/auth", createAuthRouter(trackUserError));
  app.use("/api/v1/ai", createAiRouter(() => bunkerMode));
  app.use("/api/v1/companies", companyRoutes);
  app.use("/api/v1/cashier", cashierRoutes);
  app.use("/api/v1/inventory", inventoryRoutes);
  app.use("/api/v1/wood", woodRoutes);
  app.use("/api/v1/optimizer", optimizerRoutes);
  app.use("/api/v1/deliveries", deliveriesRoutes);
  app.use("/api/v1/admin", adminRoutes);

  // Unknown API routes return clean JSON 404 instead of SPA HTML
  app.use("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ detail: "API endpoint not found" });
  });

  // Vite middleware for development, static bundle for production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[NicCore Error]", err.message);
    res.status(500).json({ detail: "Internal server error" });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`NicCore Timber ERP running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer();
