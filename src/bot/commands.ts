import { SlashCommandBuilder, REST, Routes } from "discord.js";
import { logger } from "../logger";

export const commands = [
  new SlashCommandBuilder()
    .setName("trip")
    .setDescription("Quản lý chuyến đi (Trip Management)")
    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Bắt đầu một chuyến đi mới")
        .addStringOption(opt =>
          opt.setName("name").setDescription("Tên chuyến đi (ví dụ: japan-2026)").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("country").setDescription("Quốc gia chuyến đi").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("currency").setDescription("Đơn vị tiền tệ cơ bản (ví dụ: JPY, VND)").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("end")
        .setDescription("Kết thúc chuyến đi hiện tại")
    ),

  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Xem báo cáo chi tiêu (Expense Reports)")
    .addSubcommand(sub =>
      sub
        .setName("today")
        .setDescription("Báo cáo chi tiêu trong ngày hôm nay")
    )
    .addSubcommand(sub =>
      sub
        .setName("trip")
        .setDescription("Báo cáo chi tiêu của chuyến đi")
        .addStringOption(opt =>
          opt.setName("id").setDescription("ID chuyến đi (để trống nếu muốn xem chuyến đi hiện tại)").setRequired(false)
        )
    )
];

export async function deployCommands(token: string, clientId: string) {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    logger.info("Started refreshing application (/) commands.");
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands.map(c => c.toJSON()) }
    );
    logger.info("Successfully reloaded application (/) commands.");
  } catch (error) {
    logger.error(error, "Error deploying slash commands");
  }
}
