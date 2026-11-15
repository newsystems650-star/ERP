import { Router } from "express";
import { erpStore } from "../../../services/erpStore.ts";
import { cppBridge } from "../../../core/cpp_bridge.ts";

const router = Router();

router.get("/", (req, res) => {
  res.json(erpStore.deliveries);
});

router.patch("/:id/status", async (req, res) => {
  try {
    const updated = erpStore.updateDeliveryStatus(req.params.id, req.body);
    await cppBridge.auditLog({
      action: "DELIVERY_STATUS_UPDATED",
      deliveryId: updated.id,
      ticketCode: updated.ticketCode,
      status: updated.status,
      driverName: updated.driverName,
    });
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery not found";
    res.status(404).json({ detail: message });
  }
});

export default router;
