import { Router } from "express";
import { cppBridge } from "../../../core/cpp_bridge.ts";
import { erpStore } from "../../../services/erpStore.ts";

const router = Router();

router.get("/history", (_req, res) => {
  res.json(erpStore.cutOptimizations);
});

router.post("/calculate", async (req, res) => {
  try {
    const result = await cppBridge.optimizeCuts(req.body);
    const savedRecord = erpStore.saveCutOptimization({
      engine: result.engine,
      stockWidth: result.stockWidth,
      stockHeight: result.stockHeight,
      kerfMm: result.kerfMm,
      sheetsCount: result.sheetsCount,
      totalPiecesPlaced: result.totalPiecesPlaced,
      unplacedCount: result.unplacedCount,
      efficiency: result.efficiency,
      wasteM2: result.wasteM2,
      computeTimeMs: result.computeTimeMs,
    });
    res.json({ ...result, savedId: savedRecord.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error optimizing cuts";
    res.status(400).json({ detail: message });
  }
});

export default router;
