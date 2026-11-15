import type { Company } from "../models/company.ts";
import { loadPersistedDatabase, savePersistedSection } from "./persistence.ts";

const defaultCompanies: Company[] = [
  {
    id: "1",
    name: "NicCore Maderería Matriz",
    industry: "Maderería / Aserradero",
    employees: 38,
    revenue: 12500000,
    foundedYear: 2015,
    status: 'Active',
    description: "Patio central, sierra vertical y punto de venta principal.",
    createdAt: new Date().toISOString()
  },
  {
    id: "2",
    name: "Sucursal Naucalpan Industrial",
    industry: "Distribución de Tableros",
    employees: 24,
    revenue: 8400000,
    foundedYear: 2019,
    status: 'Active',
    description: "Centro de maquila CNC y despacho de flotilla.",
    createdAt: new Date().toISOString()
  }
];

function loadInitialCompanies(): Company[] {
  const persisted = loadPersistedDatabase();
  if (Array.isArray(persisted.companies) && persisted.companies.length > 0) {
    return persisted.companies as Company[];
  }
  savePersistedSection('companies', defaultCompanies);
  return [...defaultCompanies];
}

let companies: Company[] = loadInitialCompanies();

export const companyService = {
  async getAll(): Promise<Company[]> {
    return companies;
  },

  async getById(id: string): Promise<Company | undefined> {
    return companies.find(c => c.id === id);
  },

  async create(data: Omit<Company, 'id' | 'createdAt'>): Promise<Company> {
    const newCompany: Company = {
      ...data,
      id: `co_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString()
    };
    companies.push(newCompany);
    savePersistedSection('companies', companies);
    return newCompany;
  },

  async delete(id: string): Promise<boolean> {
    const initialLength = companies.length;
    companies = companies.filter(c => c.id !== id);
    const changed = companies.length < initialLength;
    if (changed) {
      savePersistedSection('companies', companies);
    }
    return changed;
  }
};
