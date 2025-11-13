import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { currentMech } from "../../features/mechs.js";
import { SelectionKey } from "../../types.js";

export const speedCommand = new SlashCommandBuilder()
  .setName("speed")
  .setDescription("速度指数（行動順用）を計算します。")
  .addIntegerOption(o =>
    o.setName("level").setDescription("技能行使Lv（機動制御）").setRequired(true)
  )
  .toJSON();

export async function handleSpeed(i: ChatInputCommandInteraction) {
  const level = i.options.getInteger("level", true);
  const sel: SelectionKey = { userId: i.user.id, channelId: i.channelId };
  const mech = await currentMech(sel);

  if (!mech) {
    await i.reply({
      content: "選択中の機体がありません。`/ms select` で選んでから実行してね。",
      ephemeral: true,
    });
    return;
  }

  const mobility = mech.mobility ?? 0;
  const speedIndex = level * mobility;

  const result =
    "```\n" +
    `【速度指数の計算】\n` +
    `機体名： ${mech.name}\n` +
    `機動： ${mobility}\n` +
    `【機動制御】Lv：${level}\n` +
    `(速度指数) ＝ ${level} × ${mobility} ＝ ${speedIndex}` +
    "\n```";

  await i.reply({ content: result, ephemeral: true });
}
