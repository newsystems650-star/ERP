import { Router } from "express";
import { cashierService } from "../../../services/cashierService.ts";
import { erpStore } from "../../../services/erpStore.ts";
import { cppBridge } from "../../../core/cpp_bridge.ts";

const router = Router();

router.get("/tickets", (req, res) => {
  res.json(erpStore.tickets);
});

router.post("/checkout", async (req, res) => {
  try {
    const { ticket, telegramNotified } = await cashierService.processTransaction(req.body);
    res.status(201).json({ ...ticket, telegramNotified });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error processing transaction";
    res.status(400).json({ detail: message });
  }
});

router.patch("/tickets/:id/workshop", async (req, res) => {
  try {
    const { workshopStatus } = req.body;
    const updated = erpStore.updateTicketWorkshopStatus(req.params.id, workshopStatus);
    await cppBridge.auditLog({
      action: "WORKSHOP_STATUS_UPDATED",
      ticketCode: updated.code,
      workshopStatus: updated.workshopStatus,
    });
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticket not found";
    res.status(404).json({ detail: message });
  }
});

router.post("/credit-request", async (req, res) => {
  const { ticketId, customerName, amount } = req.body;
  const result = await cashierService.requestCredit(
    ticketId || "SOLICITUD-POS",
    customerName || "Cliente Mostrador",
    Number(amount) || 0
  );
  res.json({ status: "request_sent", ...result });
});

export default router;
