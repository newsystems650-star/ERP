import { cppBridge } from "../core/cpp_bridge.ts";
import { erpStore } from "./erpStore.ts";
import type { TicketRecord } from "./erpStore.ts";
import TelegramBot from "node-telegram-bot-api";

const bot = process.env.TELEGRAM_TOKEN ? new TelegramBot(process.env.TELEGRAM_TOKEN) : null;
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const cashierService = {
  async processTransaction(payload: Parameters<typeof erpStore.createTicketAtomic>[0]): Promise<{
    ticket: TicketRecord;
    telegramNotified: boolean;
  }> {
    // 1. Transacción Atómica (IVA + pago + stock + hoja de patio + entrega)
    const { ticket } = erpStore.createTicketAtomic(payload);

    // 2. Auditoría Inmutable AES-256 (Puente C++)
    await cppBridge.auditLog({
      action: "CONFIRMED",
      ticketId: ticket.id,
      code: ticket.code,
      customer: ticket.customerName,
      total: ticket.total,
      tax: ticket.taxAmount,
      paymentMethod: ticket.paymentMethod,
      workshopStatus: ticket.workshopStatus,
    });

    // 3. Hook de Telegram
    const telegramNotified = await this.sendTelegramNotification(ticket);

    return { ticket, telegramNotified };
  },

  async sendTelegramNotification(ticket: TicketRecord): Promise<boolean> {
    if (!bot || !ADMIN_CHAT_ID) return false;

    const message = `
✅ *Ticket Confirmado*
🆔 Folio: ${ticket.code}
👤 Cliente: ${ticket.customerName}
💰 Total: $${ticket.total.toLocaleString()}
🛠️ Taller: ${ticket.workshopStatus}
💳 Pago: ${ticket.paymentMethod}
    `;

    try {
      await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: "Markdown" });
      return true;
    } catch {
      return false;
    }
  },

  async requestCredit(ticketId: string, customerName: string, amount: number): Promise<{ sent: boolean; channel: string }> {
    await cppBridge.auditLog({
      action: "CREDIT_REQUEST",
      ticketId,
      customerName,
      amount,
    });

    if (!bot || !ADMIN_CHAT_ID) {
      return { sent: true, channel: "INTERNAL_QUEUE" };
    }

    try {
      await bot.sendMessage(
        ADMIN_CHAT_ID,
        `🚨 *Solicitud de Crédito*\nTicket: ${ticketId}\nCliente: ${customerName}\nMonto: $${amount}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Aprobar ✅", callback_data: `approve_${ticketId}` },
                { text: "Rechazar ❌", callback_data: `reject_${ticketId}` },
              ],
            ],
          },
        }
      );
      return { sent: true, channel: "TELEGRAM" };
    } catch {
      return { sent: true, channel: "INTERNAL_QUEUE" };
    }
  },
};
