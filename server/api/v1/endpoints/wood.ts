import { Router } from "express";
import { woodService } from "../../../services/woodService.ts";
import { erpStore } from "../../../services/erpStore.ts";
import type { WoodEntryRecord } from "../../../services/erpStore.ts";
import { cppBridge } from "../../../core/cpp_bridge.ts";

const router = Router();

router.get("/entries", (req, res) => {
  res.json(erpStore.woodEntries);
});

router.post("/calculate", (req, res) => {
  const thicknessCm = Number(req.body.thicknessCm) || 2.5;
  const widthCm = Number(req.body.widthCm) || 30;
  const lengthCm = Number(req.body.lengthCm) || 250;
  const quantity = Math.max(1, Number(req.body.quantity) || 1);
  const costPerBoardFoot = Number(req.body.costPerBoardFoot) || 28;
  const marginPercent = Number(req.body.marginPercent) || 35;

  const commercial = woodService.metricToCommercial(widthCm, thicknessCm, lengthCm);
  const boardFeetPerPiece = woodService.calculateBoardFeet(
    commercial.thicknessInch,
    commercial.widthInch,
    commercial.lengthFeet
  );
  const totalBoardFeet = Number((boardFeetPerPiece * quantity).toFixed(2));
  const totalM3 = Number((((thicknessCm / 100) * (widthCm / 100) * (lengthCm / 100)) * quantity).toFixed(4));
  const unitCost = Number((boardFeetPerPiece * costPerBoardFoot).toFixed(2));
  const publicPricePerFoot = woodService.calculatePublicPrice(costPerBoardFoot, marginPercent);
  const publicUnitPrice = Number((boardFeetPerPiece * publicPricePerFoot).toFixed(2));
  const projectedProfit = Number(woodService.calculateProfit(unitCost, publicUnitPrice, quantity).toFixed(2));

  res.json({
    ...commercial,
    boardFeetPerPiece: Number(boardFeetPerPiece.toFixed(3)),
    totalBoardFeet,
    totalM3,
    unitCost,
    publicUnitPrice,
    projectedProfit,
  });
});

router.post("/entry", async (req, res) => {
  try {
    const thicknessCm = Number(req.body.thicknessCm) || 2.5;
    const widthCm = Number(req.body.widthCm) || 30;
    const lengthCm = Number(req.body.lengthCm) || 250;
    const quantity = Math.max(1, Math.floor(Number(req.body.quantity) || 1));
    const costPerBoardFoot = Number(req.body.costPerBoardFoot) || 28;
    const marginPercent = Number(req.body.marginPercent) || 35;
    const species = String(req.body.species || "Pino Nacional");
    const woodClass = req.body.woodClass || "PRIMERA";
    const productId = req.body.productId ? String(req.body.productId) : undefined;

    const commercial = woodService.metricToCommercial(widthCm, thicknessCm, lengthCm);
    const boardFeetPerPiece = woodService.calculateBoardFeet(
      commercial.thicknessInch,
      commercial.widthInch,
      commercial.lengthFeet
    );
    const totalBoardFeet = Number((boardFeetPerPiece * quantity).toFixed(2));
    const totalM3 = Number((((thicknessCm / 100) * (widthCm / 100) * (lengthCm / 100)) * quantity).toFixed(4));
    const unitCost = Number((boardFeetPerPiece * costPerBoardFoot).toFixed(2));
    const publicPricePerFoot = woodService.calculatePublicPrice(costPerBoardFoot, marginPercent);
    const publicUnitPrice = Number((boardFeetPerPiece * publicPricePerFoot).toFixed(2));
    const projectedProfit = Number(woodService.calculateProfit(unitCost, publicUnitPrice, quantity).toFixed(2));

    const entry: WoodEntryRecord = {
      id: `we_${Date.now().toString(36)}`,
      species,
      woodClass,
      thicknessCm,
      widthCm,
      lengthCm,
      ...commercial,
      boardFeetPerPiece: Number(boardFeetPerPiece.toFixed(3)),
      quantity,
      totalBoardFeet,
      totalM3,
      costPerBoardFoot,
      marginPercent,
      unitCost,
      publicUnitPrice,
      projectedProfit,
      productId,
      createdAt: new Date().toISOString(),
    };

    const saved = erpStore.addWoodEntry(entry, productId);
    await cppBridge.auditLog({
      action: "WOOD_ENTRY_REGISTERED",
      entryId: saved.id,
      species: saved.species,
      totalBoardFeet: saved.totalBoardFeet,
      quantity: saved.quantity,
      linkedProductId: productId || null,
    });

    res.status(201).json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error registering wood entry";
    res.status(400).json({ detail: message });
  }
});

export default router;
