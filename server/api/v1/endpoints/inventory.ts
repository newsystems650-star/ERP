import { Router } from "express";
import { erpStore } from "../../../services/erpStore.ts";
import { cppBridge } from "../../../core/cpp_bridge.ts";

const router = Router();

router.get("/", (req, res) => {
  res.json(erpStore.getProducts());
});

router.post("/", async (req, res) => {
  try {
    const product = erpStore.addProduct(req.body);
    await cppBridge.auditLog({
      action: "PRODUCT_CREATED",
      productId: product.id,
      sku: product.sku,
      initialStock: product.stock,
    });
    res.status(201).json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid product payload";
    res.status(400).json({ detail: message });
  }
});

router.patch("/:id/adjust", async (req, res) => {
  try {
    const delta = Number(req.body.delta);
    const reason = String(req.body.reason || "Ajuste manual");
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ detail: "El ajuste debe ser diferente de 0" });
    }
    const updated = erpStore.adjustStock(req.params.id, delta);
    await cppBridge.auditLog({
      action: delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      productId: updated.id,
      sku: updated.sku,
      delta,
      newStock: updated.stock,
      reason,
    });
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error adjusting stock";
    res.status(400).json({ detail: message });
  }
});

export default router;
