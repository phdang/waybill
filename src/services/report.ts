import { db } from "../db/connection";
import { expenses, trips } from "../db/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { ExpenseService } from "./expense";

export function formatCurrency(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const curr = currency.toUpperCase();
  if (curr === "VND") {
    return `${num.toLocaleString("vi-VN")} ₫`;
  } else if (curr === "JPY") {
    return `${num.toLocaleString("ja-JP")} ¥`;
  } else if (curr === "USD") {
    return `$${num.toLocaleString("en-US")}`;
  } else if (curr === "EUR") {
    return `€${num.toLocaleString("de-DE")}`;
  }
  return `${num.toLocaleString("en-US")} ${curr}`;
}

export function getLocalDateString(date: Date = new Date()): string {
  // Handle timezone offsets to output correct YYYY-MM-DD locally
  const tzOffset = date.getTimezoneOffset() * 60000; // in ms
  const localTime = new Date(date.getTime() - tzOffset);
  return localTime.toISOString().split("T")[0];
}

/**
 * Formats a Date (or ISO string / timestamp) to full dd/mm/yyyy HH:mm:ss in vi-VN locale.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "N/A";

  let dateStr = "";

  if (date instanceof Date) {
    // Nếu ORM trả về đối tượng Date, ta chuyển nó sang chuỗi ISO thô: "2026-06-09T18:01:53.273Z"
    dateStr = date.toISOString();
  } else {
    dateStr = String(date);
  }

  // Dùng Regex lấy đúng thứ tự các cụm số: Năm, Tháng, Ngày, Giờ, Phút, Giây
  // Bất chấp chữ T hay chữ Z ở cuối chuỗi
  const numbers = dateStr.match(/\d+/g);
  
  if (!numbers || numbers.length < 6) return "N/A";

  const year = numbers[0];
  const month = numbers[1];
  const day = numbers[2];
  const hour = numbers[3];
  const minute = numbers[4];
  const second = numbers[5];

  // Trả về đúng định dạng text bạn mong muốn
  return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  food: "🍴 Food",
  hotel: "🏨 Hotel",
  transport: "🚗 Transport",
  ticket: "🎟️ Ticket",
  shopping: "🛍️ Shopping",
  entertainment: "🎉 Ent.",
  medical: "💊 Medical",
  other: "📦 Other",
};

export class ReportingService {
  /**
   * Compiles expense report for today
   */
  public static async getTodayReport(): Promise<string> {
    const todayStr = getLocalDateString();
    const startOfDay = new Date(todayStr);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(todayStr);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const items = await db
      .select()
      .from(expenses)
      .where(and(gte(expenses.expenseDate, startOfDay), lte(expenses.expenseDate, endOfDay)))
      .orderBy(desc(expenses.createdAt));

    if (items.length === 0) {
      return `📝 **Báo cáo chi tiêu hôm nay (${todayStr})**\n\nChưa có chi tiêu nào được ghi nhận hôm nay.`;
    }

    // Totals by currency
    const currencyTotals: Record<string, number> = {};
    // Totals by category (formatted)
    const categoryTotals: Record<string, Record<string, number>> = {};

    let listText = "";
    for (const item of items) {
      const amt = parseFloat(item.amount);
      const cur = item.currency.toUpperCase();
      const cat = item.category;

      // Aggregations
      currencyTotals[cur] = (currencyTotals[cur] || 0) + amt;

      if (!categoryTotals[cat]) categoryTotals[cat] = {};
      categoryTotals[cat][cur] = (categoryTotals[cat][cur] || 0) + amt;

      // Line item text – show full HH:mm:ss timestamp + short expense ID
      const timeStr = new Date(item.createdAt).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const shortId = item.id.slice(-8);
      listText += `• [${timeStr}] **${CATEGORY_EMOJIS[cat] || cat}** - ${item.description}: **${formatCurrency(amt, cur)}**${item.note ? ` (*${item.note}*)` : ""} \`…${shortId}\`\n`;
    }

    // Compile totals text
    let totalsText = "";
    for (const [cur, total] of Object.entries(currencyTotals)) {
      totalsText += `• **Tổng cộng**: **${formatCurrency(total, cur)}**\n`;
    }

    // Compile category breakdown
    let categoryText = "";
    for (const [cat, curs] of Object.entries(categoryTotals)) {
      const sums = Object.entries(curs)
        .map(([cur, val]) => formatCurrency(val, cur))
        .join(" + ");
      categoryText += `• **${CATEGORY_EMOJIS[cat] || cat}**: ${sums}\n`;
    }

    return `📝 **Báo cáo chi tiêu hôm nay (${todayStr})**\n\n` +
      `### Chi tiết:\n${listText}\n` +
      `### Phân loại:\n${categoryText}\n` +
      `### Tổng cộng hôm nay:\n${totalsText}`;
  }

  /**
   * Compiles expense report for a trip
   */
  public static async getTripReport(tripId?: string): Promise<string> {
    let targetTrip;
    
    if (tripId) {
      targetTrip = await ExpenseService.getTripById(tripId);
    } else {
      targetTrip = await ExpenseService.getActiveTrip();
    }

    if (!targetTrip) {
      return "⚠️ Không tìm thấy chuyến đi nào đang hoạt động hoặc ID chuyến đi không hợp lệ.";
    }

    const items = await db
      .select()
      .from(expenses)
      .where(eq(expenses.tripId, targetTrip.id))
      .orderBy(expenses.expenseDate);

    const tripHeader = `✈️ **Báo cáo chuyến đi: ${targetTrip.name}**\n` +
      `• ID: \`${targetTrip.id}\`\n` +
      `• Quốc gia: ${targetTrip.country || "Chưa thiết lập"} | Tiền tệ: ${targetTrip.baseCurrency || "VND"}\n` +
      `• Bắt đầu: ${formatDateTime(targetTrip.startedAt)}\n` +
      `• Trạng thái: ${targetTrip.status === "active" ? "🟢 Đang diễn ra" : "🔴 Đã kết thúc"}\n` +
      (targetTrip.endedAt ? `• Kết thúc: ${formatDateTime(targetTrip.endedAt)}\n` : "");

    if (items.length === 0) {
      return `${tripHeader}\nChưa có chi tiêu nào được ghi nhận cho chuyến đi này.`;
    }

    // Totals by currency
    const currencyTotals: Record<string, number> = {};
    // Totals by category (formatted)
    const categoryTotals: Record<string, Record<string, number>> = {};

    let listText = "";
    for (const item of items) {
      const amt = parseFloat(item.amount);
      const cur = item.currency.toUpperCase();
      const cat = item.category;

      // Aggregations
      currencyTotals[cur] = (currencyTotals[cur] || 0) + amt;

      if (!categoryTotals[cat]) categoryTotals[cat] = {};
      categoryTotals[cat][cur] = (categoryTotals[cat][cur] || 0) + amt;

      // Line item text – show full date + HH:mm:ss timestamp + short expense ID
      const expenseDateTimeStr = formatDateTime(item.expenseDate)
      const expenseId = item.id;
      listText += `• [${expenseDateTimeStr}] **${CATEGORY_EMOJIS[cat] || cat}** - ${item.description}: **${formatCurrency(amt, cur)}**${item.note ? ` (*${item.note}*)` : ""} \` ID: ${expenseId}\`\n`;
    }

    // Compile totals text
    let totalsText = "";
    for (const [cur, total] of Object.entries(currencyTotals)) {
      totalsText += `• **Tổng cộng**: **${formatCurrency(total, cur)}**\n`;
    }

    // Compile category breakdown
    let categoryText = "";
    for (const [cat, curs] of Object.entries(categoryTotals)) {
      const sums = Object.entries(curs)
        .map(([cur, val]) => formatCurrency(val, cur))
        .join(" + ");
      categoryText += `• **${CATEGORY_EMOJIS[cat] || cat}**: ${sums}\n`;
    }

    return `${tripHeader}\n` +
      `### Danh sách chi tiêu:\n${listText}\n` +
      `### Phân loại:\n${categoryText}\n` +
      `### Tổng kết chi phí chuyến đi:\n${totalsText}`;
  }

  /**
   * Compiles a summary list of all trips with IDs and key metadata
   */
  public static async getAllTripsReport(): Promise<string> {
    const allTrips = await db
      .select()
      .from(trips)
      .orderBy(desc(trips.createdAt));

    if (allTrips.length === 0) {
      return "📋 **Danh sách chuyến đi**\n\nChưa có chuyến đi nào được tạo.";
    }

    let listText = "";
    for (const trip of allTrips) {
      const statusIcon = trip.status === "active" ? "🟢" : "🔴";
      const startStr = trip.startedAt
        ? formatDateTime(trip.startedAt)
        : "N/A";
      const endStr = trip.endedAt
        ? formatDateTime(trip.endedAt)
        : null;

      listText +=
        `${statusIcon} **${trip.name}**\n` +
        `  • ID: \`${trip.id}\`\n` +
        `  • Quốc gia: ${trip.country || "Chưa thiết lập"} | Tiền tệ: ${trip.baseCurrency}\n` +
        `  • Bắt đầu: ${startStr}\n` +
        (endStr ? `  • Kết thúc: ${endStr}\n` : "") +
        "\n";
    }

    return `📋 **Danh sách chuyến đi (${allTrips.length} chuyến)**\n\n${listText}` +
      `> Dùng \`/trip list\` để xem, \`/report trip id:<ID>\` để xem chi tiết chi tiêu theo ID.`;
  }
}
