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
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("Liệt kê tất cả các chuyến đi (kèm ID)")
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
    ),

  new SlashCommandBuilder()
    .setName("expense")
    .setDescription("Quản lý chi tiêu (Expense Management)")
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("Xem chi tiết một khoản chi tiêu và danh sách ảnh đính kèm")
        .addStringOption(opt =>
          opt.setName("id").setDescription("ID của khoản chi tiêu").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Chỉnh sửa thông tin một khoản chi tiêu")
        .addStringOption(opt =>
          opt.setName("id").setDescription("ID của khoản chi tiêu cần sửa").setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName("amount").setDescription("Số tiền mới").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("currency").setDescription("Đơn vị tiền tệ mới (ví dụ: VND, JPY)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("category")
            .setDescription("Phân loại mới")
            .setRequired(false)
            .addChoices(
              { name: "🍴 Food (Ăn uống)", value: "food" },
              { name: "🏨 Hotel (Khách sạn)", value: "hotel" },
              { name: "🚗 Transport (Di chuyển)", value: "transport" },
              { name: "🎟️ Ticket (Vé)", value: "ticket" },
              { name: "🛍️ Shopping (Mua sắm)", value: "shopping" },
              { name: "🎉 Entertainment (Giải trí)", value: "entertainment" },
              { name: "💊 Medical (Y tế)", value: "medical" },
              { name: "📦 Other (Khác)", value: "other" },
            )
        )
        .addStringOption(opt =>
          opt.setName("description").setDescription("Mô tả mới cho khoản chi tiêu").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("note").setDescription("Ghi chú thêm").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("date").setDescription("Ngày chi tiêu mới (định dạng YYYY-MM-DD, ví dụ: 2026-06-09)").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Xóa một khoản chi tiêu (và toàn bộ ảnh đính kèm)")
        .addStringOption(opt =>
          opt.setName("id").setDescription("ID của khoản chi tiêu cần xóa").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("attach")
        .setDescription("Thêm ảnh bổ sung vào khoản chi tiêu (ảnh địa điểm, ảnh kỷ niệm, v.v.)")
        .addStringOption(opt =>
          opt.setName("id").setDescription("ID của khoản chi tiêu").setRequired(true)
        )
        .addAttachmentOption(opt =>
          opt.setName("image").setDescription("Ảnh muốn đính kèm (JPG, PNG, WEBP)").setRequired(true)
        )
    ),
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
