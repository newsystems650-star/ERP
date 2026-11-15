import { Router } from "express";
import { companyService } from "../../../services/companyService.ts";

const router = Router();

router.get("/", async (req, res) => {
  const companies = await companyService.getAll();
  res.json(companies);
});

router.get("/:id", async (req, res) => {
  const company = await companyService.getById(req.params.id);
  if (!company) return res.status(404).json({ detail: "Company not found" });
  res.json(company);
});

router.post("/", async (req, res) => {
  try {
    const company = await companyService.create(req.body);
    res.status(201).json(company);
  } catch (error) {
    res.status(400).json({ detail: "Invalid data" });
  }
});

router.delete("/:id", async (req, res) => {
  const success = await companyService.delete(req.params.id);
  if (!success) return res.status(404).json({ detail: "Company not found" });
  res.status(204).send();
});

export default router;
