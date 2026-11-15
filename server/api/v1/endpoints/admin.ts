import { Router } from "express";
import { erpStore } from "../../../services/erpStore.ts";
import { cppBridge } from "../../../core/cpp_bridge.ts";
import { companyService } from "../../../services/companyService.ts";
import { authService } from "../../../services/authService.ts";

const router = Router();

router.get("/reports", (req, res) => {
  res.json(erpStore.getReportsSummary());
});

router.get("/reports/saved", (req, res) => {
  res.json(erpStore.savedReports);
});

router.post("/reports/save", async (req, res) => {
  try {
    const { title, createdBy } = req.body || {};
    const report = erpStore.saveReportSnapshot(title, createdBy);
    await cppBridge.auditLog({
      action: "REPORT_SAVED",
      reportId: report.id,
      title: report.title,
      totalSales: report.totalSales,
    });
    res.status(201).json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error saving report";
    res.status(400).json({ detail: message });
  }
});

router.get("/invoices", (req, res) => {
  res.json(erpStore.invoices);
});

router.post("/invoices", async (req, res) => {
  try {
    const invoice = erpStore.createInvoiceFromTicket(req.body || {});
    await cppBridge.auditLog({
      action: "INVOICE_STAMPED",
      invoiceId: invoice.id,
      folio: invoice.folio,
      uuid: invoice.uuid,
      ticketCode: invoice.ticketCode,
      rfcReceptor: invoice.rfcReceptor,
      total: invoice.total,
    });
    res.status(201).json(invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creating invoice";
    res.status(400).json({ detail: message });
  }
});

router.patch("/invoices/:id/cancel", async (req, res) => {
  try {
    const updated = erpStore.cancelInvoice(req.params.id);
    await cppBridge.auditLog({
      action: "INVOICE_CANCELLED",
      invoiceId: updated.id,
      folio: updated.folio,
    });
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice not found";
    res.status(404).json({ detail: message });
  }
});

router.get("/audit-logs", (req, res) => {
  const decrypt = req.query.decrypt === "true";
  const logs = cppBridge.getAuditLogs(decrypt);
  res.json({
    count: logs.length,
    engine: cppBridge.getStatus(),
    entries: logs,
  });
});

router.get("/database-status", async (req, res) => {
  const companies = await companyService.getAll();
  const auditLogs = cppBridge.getAuditLogs(false);
  const users = authService.listPublicUsers();
  res.json(erpStore.getDatabaseOverview(auditLogs.length, companies.length, users.length));
});

export default router;
