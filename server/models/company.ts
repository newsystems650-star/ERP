export interface Company {
  id: string;
  name: string;
  industry: string;
  employees: number;
  revenue: number;
  foundedYear: number;
  status: 'Active' | 'Inactive' | 'Pending';
  description: string;
  createdAt: string;
}
