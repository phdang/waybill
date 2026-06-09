import { db } from "../db/connection";
import { trips, expenses, attachments } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../logger";

export interface CreateTripInput {
  name: string;
  country?: string;
  baseCurrency?: string;
}

export interface CreateExpenseInput {
  amount: number;
  currency: string;
  category: "food" | "hotel" | "transport" | "ticket" | "shopping" | "entertainment" | "medical" | "other";
  description: string;
  note?: string;
  sourceType: "text" | "image" | "voice" | "manual";
  expenseDate?: string; // YYYY-MM-DD
  tripId?: string;
}

export class ExpenseService {
  /**
   * Starts a new trip. Ends any currently active trips.
   */
  public static async startTrip(input: CreateTripInput) {
    const now = new Date();

    // End any currently active trips first
    const activeTrips = await db
      .select()
      .from(trips)
      .where(eq(trips.status, "active"));

    for (const trip of activeTrips) {
      await db
        .update(trips)
        .set({
          status: "completed",
          endedAt: now,
        })
        .where(eq(trips.id, trip.id));
      
      logger.info({ tripId: trip.id, name: trip.name }, "Auto-completed active trip to start a new one");
    }

    // Insert new trip
    const [newTrip] = await db
      .insert(trips)
      .values({
        name: input.name,
        country: input.country || null,
        baseCurrency: input.baseCurrency || "VND",
        status: "active",
        startedAt: now,
      })
      .returning();

    logger.info({ event: "trip_started", tripId: newTrip.id, name: newTrip.name }, `Started trip: ${newTrip.name}`);
    return newTrip;
  }

  /**
   * Ends the currently active trip.
   */
  public static async endTrip() {
    const now = new Date();
    const [activeTrip] = await db
      .select()
      .from(trips)
      .where(eq(trips.status, "active"))
      .limit(1);

    if (!activeTrip) {
      logger.warn("No active trip to end");
      return null;
    }

    const [endedTrip] = await db
      .update(trips)
      .set({
        status: "completed",
        endedAt: now,
      })
      .where(eq(trips.id, activeTrip.id))
      .returning();

    logger.info({ event: "trip_ended", tripId: endedTrip.id, name: endedTrip.name }, `Ended trip: ${endedTrip.name}`);
    return endedTrip;
  }

  /**
   * Gets the currently active trip if one exists.
   */
  public static async getActiveTrip() {
    const [activeTrip] = await db
      .select()
      .from(trips)
      .where(eq(trips.status, "active"))
      .limit(1);
    return activeTrip || null;
  }

  /**
   * Creates an expense entry. Links to the active trip if tripId is not supplied.
   */
  public static async createExpense(input: CreateExpenseInput) {
    let targetTripId = input.tripId;
    let tripName = "no_active_trip";

    // If tripId is not supplied, try to fetch the active trip
    if (!targetTripId) {
      const activeTrip = await this.getActiveTrip();
      if (activeTrip) {
        targetTripId = activeTrip.id;
        tripName = activeTrip.name;
      }
    } else {
      const [trip] = await db.select().from(trips).where(eq(trips.id, targetTripId)).limit(1);
      if (trip) {
        tripName = trip.name;
      }
    }

    const dateStr = input.expenseDate || new Date().toISOString().split("T")[0];

    const [newExpense] = await db
      .insert(expenses)
      .values({
        tripId: targetTripId || null,
        amount: input.amount.toString(),
        currency: input.currency.toUpperCase(),
        category: input.category,
        description: input.description,
        note: input.note || null,
        sourceType: input.sourceType,
        expenseDate: dateStr,
      })
      .returning();

    // Log in the format requested by the user:
    // {"event":"expense_created","trip":"japan-2026","amount":120000,"category":"food"}
    logger.info({
      event: "expense_created",
      trip: tripName,
      amount: input.amount,
      category: input.category,
      expenseId: newExpense.id,
    }, "Created new expense entry");

    return newExpense;
  }

  /**
   * Links a file attachment to an expense
   */
  public static async addAttachment(expenseId: string, storageKey: string, mimeType: string) {
    const [newAttachment] = await db
      .insert(attachments)
      .values({
        expenseId,
        storageKey,
        mimeType,
      })
      .returning();

    logger.info({ attachmentId: newAttachment.id, expenseId, storageKey }, "Saved expense attachment reference");
    return newAttachment;
  }

  /**
   * Retrieves all trips
   */
  public static async getAllTrips() {
    return db.select().from(trips).orderBy(desc(trips.createdAt));
  }

  /**
   * Retrieves details of a specific trip
   */
  public static async getTripById(id: string) {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    return trip || null;
  }
}
