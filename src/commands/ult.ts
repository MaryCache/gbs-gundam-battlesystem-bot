import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { loadBoard, setUlt, toggleUlt } from "../features/board.js";

/**
 * /ult <name> [mode]
 *   - name: 盤面に登録済みのキャラ名（完全一致）
 *   - mode: on | off | toggle （省略時は toggle）
 * 予約は「tmpUlt」に入り、確定まで公開されません（ephemeralで応答）。
 */
export const ultCommand = new SlashCommandBuilder()
  .setName("ult")
  .setDescription("（非公開）キャラのULT予約を設定します。")
  .addStringOption(o =>
    o.setName("name")
     .setDescription("盤面に登録済みのキャラ名（完全一致）")
     .setRequired(true))
  .addStringOption(o =>
    o.setName("mode")
     .setDescription("on / off / toggle（省略時は toggle）")
     .addChoices(
        { name: "on", value: "on" },
        { name: "off", value: "off" },
        { name: "toggle", value: "toggle" },
     )
     .setRequired(false))
  .toJSON();

export async function handleUlt(i: ChatInputCommandInteraction) {
  const name = i.options.getString("name", true);
  const mode = (i.options.getString("mode") ?? "toggle") as "on" | "off" | "toggle";
  const channelId = i.channelId;

  const st = await loadBoard(channelId);
  if (!st) {
    await i.reply({ content: "このチャンネルに盤面がありません。`/board create` から。", flags: 64 });
    return;
  }
  const m = st.members.find(x => x.name === name);
  if (!m) {
    await i.reply({ content: `「${name}」という参加者が見つかりません。/board add で追加してね。`, flags: 64 });
    return;
  }

  if (mode === "on") {
    await setUlt(channelId, m.id, true);
    await i.reply({ content: `**${name}** のULTを **ON** に予約しました。`, flags: 64 });
    return;
  }
  if (mode === "off") {
    await setUlt(channelId, m.id, false);
    await i.reply({ content: `**${name}** のULTを **OFF** に予約しました。`, flags: 64 });
    return;
  }

  const { on } = await toggleUlt(channelId, m.id);
  await i.reply({ content: `**${name}** のULTを **${on ? "ON" : "OFF"}** に切り替えました。`, flags: 64 });
}
