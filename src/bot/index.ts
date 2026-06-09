import { Client, GatewayIntentBits, Partials, ActivityType } from "discord.js";
import { logger } from "../logger";
import { deployCommands } from "./commands";
import { ExpenseService } from "../services/expense";
import { ReportingService, formatCurrency } from "../services/report";
import { AIService } from "../services/ai";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

function getExtensionFromMime(mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".bin";
}

/**
 * Saves a file buffer securely under storage/receipts/YYYY/MM/ using UUIDs
 */
export async function saveAttachmentSafely(buffer: Buffer, originalFilename: string, mimeType: string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  
  const sandboxDir = "/home/waybill/storage";
  const relativeSubpath = path.join("receipts", year, month);
  const targetDir = path.join(sandboxDir, relativeSubpath);
  
  // Ensure the target directory exists
  await fs.promises.mkdir(targetDir, { recursive: true });
  
  const ext = path.extname(originalFilename) || getExtensionFromMime(mimeType);
  const randomName = `${crypto.randomUUID()}${ext}`;
  const safeFilename = path.basename(randomName); // Prevents directory traversal
  
  const absolutePath = path.join(targetDir, safeFilename);
  const resolvedPath = path.resolve(absolutePath);
  
  // Path traversal boundary validation
  if (!resolvedPath.startsWith(path.resolve(sandboxDir) + path.sep)) {
    throw new Error("Path traversal check failed: target path is outside sandbox boundaries.");
  }
  
  await fs.promises.writeFile(resolvedPath, buffer);
  
  // Return the logical storage key requested by the user: receipts/YYYY/MM/filename
  return path.join("receipts", year, month, safeFilename);
}

export function startDiscordBot() {
  if (!DISCORD_TOKEN) {
    logger.warn("DISCORD_TOKEN is missing. Discord bot will not start.");
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once("ready", async (readyClient) => {
    logger.info({ botUser: readyClient.user.tag }, "Discord Bot logged in successfully!");
    
    // Register slash commands
    await deployCommands(DISCORD_TOKEN, readyClient.user.id);
    
    readyClient.user.setActivity({
      name: "chi tiêu chuyến đi 💸",
      type: ActivityType.Watching,
    });
  });

  // 1. Interaction (Slash Command) Routing
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Restrict bot commands to specific guild and channel IDs
    if (interaction.guildId !== DISCORD_GUILD_ID || interaction.channelId !== DISCORD_CHANNEL_ID) {
      await interaction.reply({
        content: `❌ Lệnh này chỉ có thể được sử dụng trong kênh được cho phép (Channel ID: ${DISCORD_CHANNEL_ID || "chưa cấu hình"}).`,
        ephemeral: true,
      });
      return;
    }

    const { commandName, options } = interaction;

    try {
      if (commandName === "trip") {
        const subcommand = options.getSubcommand();
        
        if (subcommand === "start") {
          const name = options.getString("name", true);
          const country = options.getString("country") || undefined;
          const currency = options.getString("currency") || undefined;

          await interaction.deferReply();
          const trip = await ExpenseService.startTrip({ name, country, baseCurrency: currency });
          
          await interaction.editReply(
            `🟢 **Đã khởi hành chuyến đi mới!**\n` +
            `• Tên: **${trip.name}**\n` +
            `• Quốc gia: **${trip.country || "Chưa thiết lập"}**\n` +
            `• Tiền tệ cơ bản: **${trip.baseCurrency}**\n` +
            `• ID: \`${trip.id}\``
          );
        } else if (subcommand === "end") {
          await interaction.deferReply();
          const trip = await ExpenseService.endTrip();
          
          if (!trip) {
            await interaction.editReply("⚠️ Hiện không có chuyến đi nào đang hoạt động.");
          } else {
            await interaction.editReply(`🔴 **Đã kết thúc chuyến đi: ${trip.name}!**`);
          }
        } else if (subcommand === "list") {
          await interaction.deferReply();
          const report = await ReportingService.getAllTripsReport();
          await interaction.editReply(report);
        }
      }

      else if (commandName === "report") {
        const subcommand = options.getSubcommand();
        await interaction.deferReply();

        if (subcommand === "today") {
          const report = await ReportingService.getTodayReport();
          await interaction.editReply(report);
        } else if (subcommand === "trip") {
          const tripId = options.getString("id") || undefined;
          const report = await ReportingService.getTripReport(tripId);
          await interaction.editReply(report);
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message, commandName }, "Error executing command interaction");
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Có lỗi xảy ra khi thực hiện lệnh này.");
      } else {
        await interaction.reply({ content: "❌ Có lỗi xảy ra khi thực hiện lệnh này.", ephemeral: true });
      }
    }
  });

  // 2. Chat AI Mode & Receipt Handling
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // Restrict message tracking to specific guild and channel IDs
    if (message.guildId !== DISCORD_GUILD_ID || message.channelId !== DISCORD_CHANNEL_ID) {
      return;
    }

    // Ignore prefix commands like /trip start in text handler to avoid duplicate executions
    if (message.content.startsWith("/")) return;

    const hasAttachments = message.attachments.size > 0;
    const isImage = hasAttachments && Array.from(message.attachments.values()).some(att => 
      att.contentType?.startsWith("image/")
    );

    // If there is text or image attachment, process
    if (message.content.trim() || isImage) {
      try {
        // Handle images/receipts
        if (isImage) {
          const imageAttachment = Array.from(message.attachments.values()).find(att => 
            att.contentType?.startsWith("image/")
          );
          if (!imageAttachment) return;

          const typingPromise = message.channel.sendTyping();
          logger.info({ attachmentUrl: imageAttachment.url }, "Processing receipt upload from Discord message");

          // Download image
          const downloadRes = await fetch(imageAttachment.url);
          if (!downloadRes.ok) {
            throw new Error(`Failed to download attachment: ${downloadRes.statusText}`);
          }
          const arrayBuffer = await downloadRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // OCR & AI extraction
          const aiResult = await AIService.extractFromImage(buffer, imageAttachment.contentType || "image/jpeg");

          if (aiResult.intent === "add_expense" && aiResult.amount && aiResult.category) {
            const expense = await ExpenseService.createExpense({
              amount: aiResult.amount,
              currency: aiResult.currency || "VND",
              category: aiResult.category,
              description: aiResult.description || "Chi tiêu qua hóa đơn",
              sourceType: "image",
              expenseDate: aiResult.expenseDate,
            });

            // Save attachment to storage and database
            const storageKey = await saveAttachmentSafely(buffer, imageAttachment.name, imageAttachment.contentType || "image/jpeg");
            await ExpenseService.addAttachment(expense.id, storageKey, imageAttachment.contentType || "image/jpeg");

            await message.reply(
              `📸 **Đã quét hóa đơn & ghi nhận chi tiêu!**\n` +
              `• Nội dung: **${expense.description}**\n` +
              `• Chi phí: **${formatCurrency(expense.amount, expense.currency)}**\n` +
              `• Phân loại: **${expense.category.toUpperCase()}**\n` +
              `• Ngày: **${expense.expenseDate}**\n` +
              `• File: \`${storageKey}\``
            );
          } else {
            await message.reply("⚠️ Bot không thể nhận diện được hóa đơn chi tiêu này. Vui lòng nhập chi tiết thủ công hoặc thử ảnh khác.");
          }
          return;
        }

        // Handle text message AI extraction
        const input = message.content.trim();
        
        // Quick local check if it resembles an expense to avoid token wasting
        const textLower = input.toLowerCase();
        const hasNumber = /\d+/.test(textLower);
        if (!hasNumber) {
          // Just casual talk, ignore
          return;
        }

        const typingPromise = message.channel.sendTyping();
        const aiResult = await AIService.extractFromText(input);

        if (aiResult.intent === "add_expense" && aiResult.amount && aiResult.category) {
          const expense = await ExpenseService.createExpense({
            amount: aiResult.amount,
            currency: aiResult.currency || "VND",
            category: aiResult.category,
            description: aiResult.description || input,
            sourceType: "text",
            expenseDate: aiResult.expenseDate,
          });

          await message.reply(
            `💸 **Đã ghi nhận chi tiêu!**\n` +
            `• Nội dung: **${expense.description}**\n` +
            `• Chi phí: **${formatCurrency(expense.amount, expense.currency)}**\n` +
            `• Phân loại: **${expense.category.toUpperCase()}**\n` +
            `• Ngày: **${expense.expenseDate}**`
          );
        }
      } catch (err: any) {
        logger.error({ error: err.message }, "Error processing AI message creation");
      }
    }
  });

  client.login(DISCORD_TOKEN).catch((err) => {
    logger.error(err, "Failed to login to Discord");
  });

  return client;
}
