import * as dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { logger } from "./logger";
import { startDiscordBot, saveAttachmentSafely } from "./bot";
import { ExpenseService } from "./services/expense";
import { ReportingService } from "./services/report";
import { AIService } from "./services/ai";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Use Express JSON middleware
app.use(express.json());

// Set up Multer for secure file uploads using memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB size limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ tải lên các tệp tin hình ảnh (JPEG, PNG, WEBP)."));
    }
  },
});

// Helper for sending standard errors
function handleError(res: express.Response, error: any, customMsg: string, status = 500) {
  logger.error({ error: error.message }, customMsg);
  res.status(status).json({
    success: false,
    error: error.message || "Internal Server Error",
  });
}

// REST API Endpoints

// 0. List all trips
app.get("/trips", async (req, res) => {
  try {
    const allTrips = await ExpenseService.getAllTrips();
    res.json({ success: true, trips: allTrips });
  } catch (err: any) {
    handleError(res, err, "Failed to list trips through API");
  }
});

// 1. Create a trip
app.post("/trips", async (req, res) => {
  try {
    const { name, country, base_currency } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: "Tên chuyến đi là bắt buộc." });
      return;
    }
    const trip = await ExpenseService.startTrip({
      name,
      country,
      baseCurrency: base_currency,
    });
    res.status(201).json({ success: true, trip });
  } catch (err: any) {
    handleError(res, err, "Failed to create trip through API");
  }
});

// 2. Create an expense manually
app.post("/expenses", async (req, res) => {
  try {
    const { amount, currency, category, description, note, trip_id, source_type } = req.body;
    
    if (!amount || !currency || !category || !description) {
      res.status(400).json({
        success: false,
        error: "Các trường amount, currency, category, description là bắt buộc.",
      });
      return;
    }

    const allowedCategories = ["food", "hotel", "transport", "ticket", "shopping", "entertainment", "medical", "other"];
    if (!allowedCategories.includes(category)) {
      res.status(400).json({
        success: false,
        error: `Phân loại không hợp lệ. Phải là một trong: ${allowedCategories.join(", ")}`,
      });
      return;
    }

    const expense = await ExpenseService.createExpense({
      amount: parseFloat(amount),
      currency,
      category: category as any,
      description,
      note,
      tripId: trip_id,
      sourceType: source_type || "manual"
    });

    res.status(201).json({ success: true, expense });
  } catch (err: any) {
    handleError(res, err, "Failed to create expense through API");
  }
});

// 3. Get report for today
app.get("/reports/today", async (req, res) => {
  try {
    const reportText = await ReportingService.getTodayReport();
    res.json({ success: true, report: reportText });
  } catch (err: any) {
    handleError(res, err, "Failed to fetch today's report through API");
  }
});

// 4. Get report for a specific trip
app.get("/reports/trip/:id", async (req, res) => {
  try {
    const tripId = req.params.id;
    const reportText = await ReportingService.getTripReport(tripId);
    res.json({ success: true, report: reportText });
  } catch (err: any) {
    handleError(res, err, "Failed to fetch trip report through API");
  }
});

// 5. Upload receipt photo and process it via OCR / Vision AI
app.post("/receipts/upload", upload.single("receipt"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: "Vui lòng chọn tệp tin hóa đơn (receipt) để tải lên." });
      return;
    }

    logger.info({ filename: file.originalname, size: file.size }, "Processing API receipt upload");

    // Perform OCR Vision analysis using image buffer
    const aiResult = await AIService.extractFromImage(file.buffer, file.mimetype);

    if (aiResult.intent === "add_expense" && aiResult.amount && aiResult.category) {
      // Create expense
      const expense = await ExpenseService.createExpense({
        amount: aiResult.amount,
        currency: aiResult.currency || "VND",
        category: aiResult.category,
        description: aiResult.description || "Tải lên hóa đơn",
        sourceType: "image",
        expenseDate: aiResult.expenseDate,
      });

      // Save attachment file to disk securely
      const storageKey = await saveAttachmentSafely(file.buffer, file.originalname, file.mimetype);
      
      // Save attachment metadata reference
      const attachment = await ExpenseService.addAttachment(expense.id, storageKey, file.mimetype);

      res.status(201).json({
        success: true,
        expense,
        attachment,
        extracted: aiResult,
      });
    } else {
      res.status(422).json({
        success: false,
        error: "Không thể trích xuất thông tin hóa đơn chi tiêu từ hình ảnh này.",
      });
    }
  } catch (err: any) {
    handleError(res, err, "Failed to process receipt upload");
  }
});

// Global error handler for multer / routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err, "Express application unhandled error");
  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// Start Express and Discord bot
const server = app.listen(PORT, "127.0.0.1", () => {
  logger.info(`Express server running on http://127.0.0.1:${PORT}`);
  
  // Initialize Discord bot
  startDiscordBot();
});
