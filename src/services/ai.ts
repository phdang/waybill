import * as dotenv from "dotenv";
import { logger } from "../logger";

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

export interface ExtractedExpense {
  intent: "add_expense" | "ignore";
  amount?: number;
  currency?: string;
  category?: "food" | "hotel" | "transport" | "ticket" | "shopping" | "entertainment" | "medical" | "other";
  description?: string;
  expenseDate?: string;
}

export class AIService {
  private static async callOpenRouter(messages: any[]): Promise<any> {
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not set in environment variables");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://github.com/phdang/waybill",
        "X-Title": "Waybill Expense Tracker",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "OpenRouter API call failed");
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  private static cleanJson(raw: string): string {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
  }

  /**
   * Parse plain text input to extract expense information
   */
  public static async extractFromText(text: string): Promise<ExtractedExpense> {
    const currentDate = new Date().toISOString().split("T")[0];
    const systemPrompt = `You are an AI assistant for a travel expense tracker.
Analyze the user's message and extract the expense information.
The current date is: ${currentDate}.

You must output a JSON object strictly matching this schema:
{
  "intent": "add_expense" | "ignore",
  "amount": number (the numeric amount of the expense, without currency symbols, e.g. 120000 for 120k, 1800 for 1800 JPY),
  "currency": string (ISO 3-letter currency code, e.g. "VND", "JPY", "USD". If not specified, default to "VND"),
  "category": "food" | "hotel" | "transport" | "ticket" | "shopping" | "entertainment" | "medical" | "other",
  "description": string (brief description of the expense in Vietnamese, e.g. "Ăn sáng", "Taxi", "Vé Disney"),
  "expenseDate": string (date format YYYY-MM-DD)
}

Category guidelines:
- "food": Restaurants, cafes, breakfasts, bún bò, food, meals.
- "hotel": Accommodation, hotels, homestays, hostels.
- "transport": Taxi, Grab, trains, flights, bus, transport.
- "ticket": Tickets, museum entry, Disney tickets, sightseeing tickets.
- "shopping": Shopping, buying clothes, souvenirs.
- "entertainment": Movies, bars, clubs, activities.
- "medical": Pharmacy, hospital, medicine.
- "other": Anything else.

If the input is not an expense or cannot be determined as one, set "intent" to "ignore" and all other fields to null/empty.

Output ONLY valid JSON. Do not include markdown formatting, backticks (\`\`\`json), or explanations.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ];

    try {
      logger.info({ text }, "Extracting expense from text");
      const result = await this.callOpenRouter(messages);
      const rawContent = result.choices?.[0]?.message?.content || "";
      const cleanedContent = this.cleanJson(rawContent);
      const parsed: ExtractedExpense = JSON.parse(cleanedContent);

      logger.info({ parsed }, "Text extraction completed");
      return parsed;
    } catch (error: any) {
      logger.error({ error: error.message, text }, "Failed to extract expense from text");
      return { intent: "ignore" };
    }
  }

  /**
   * Parse image attachment to extract expense information using Vision
   */
  public static async extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<ExtractedExpense> {
    const currentDate = new Date().toISOString().split("T")[0];
    const base64Image = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const systemPrompt = `You are an AI assistant that extracts expense details from receipt images.
Analyze the provided receipt image and extract the expense details.
The current date is: ${currentDate}.

You must output a JSON object strictly matching this schema:
{
  "intent": "add_expense" | "ignore",
  "amount": number (total amount paid on the receipt, as a number),
  "currency": string (ISO 3-letter currency code, e.g. "VND", "JPY", "USD". Infer from context, location, or currency symbol on the receipt. If VND is likely due to Vietnamese text/names, use VND),
  "category": "food" | "hotel" | "transport" | "ticket" | "shopping" | "entertainment" | "medical" | "other",
  "description": string (brief summary/description of the items, e.g., "Hóa đơn siêu thị", "Ăn uống nhà hàng", "Vé tàu"),
  "expenseDate": string (date format YYYY-MM-DD. Extract the receipt transaction date if visible, otherwise use current date)
}

Output ONLY valid JSON. Do not include markdown formatting, backticks, or explanations.`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ];

    try {
      logger.info("Extracting expense from image using vision model");
      const result = await this.callOpenRouter(messages);
      const rawContent = result.choices?.[0]?.message?.content || "";
      const cleanedContent = this.cleanJson(rawContent);
      const parsed: ExtractedExpense = JSON.parse(cleanedContent);

      logger.info({ parsed }, "Vision extraction completed");
      return parsed;
    } catch (error: any) {
      logger.error({ error: error.message }, "Failed to extract expense from image");
      return { intent: "ignore" };
    }
  }
}
