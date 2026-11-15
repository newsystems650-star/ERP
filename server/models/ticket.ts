export type WorkshopStatus = 'Pending' | 'In Progress' | 'Completed' | 'Delivered';
export type PaymentMethod = 'Cash' | 'Card' | 'Transfer' | 'Credit';

export interface Ticket {
  id: string;
  companyId: string;
  items: TicketItem[];
  subtotal: number;
  taxAmount: number; // IVA
  total: number;
  paymentMethod: PaymentMethod;
  workshopStatus: WorkshopStatus;
  customerName: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface TicketItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  cuts?: string; // Información para el optimizador
}
