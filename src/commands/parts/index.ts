import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { destroyPart, destroyRandom, resetParts, formatStatus } from "../../features/parts/index.js";

/**
 * /parts show                  … 現在の部位状況を表示
 * /parts break number:3        … 指定の部位番号(1..8)を破壊
 * /parts random count:2        … ランダムにN箇所破壊（未破壊から抽選）
 * /parts reset                 … 破壊記録をリセット
 *
 * ※ 記録は「選択中機体」単位
 */
export const partsCommand = new SlashCommandBuilder()
  .setName("parts")
  .setDescription("部位の破壊記録を管理します（選択中機体単位）")
  .addSubcommand((sc) =>
    sc.setName("show").setDescription("現在の部位状況を表示")
  )
  .addSubcommand((sc) =>
    sc
      .setName("break")
      .setDescription("指定の部位番号(1..8)を破壊")
      .addIntegerOption((o) =>
        o.setName("number").setDescription("1..8").setRequired(true).setMinValue(1).setMaxValue(8)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("random")
      .setDescription("未破壊からランダムに N 箇所破壊")
      .addIntegerOption((o) =>
        o.setName("count").setDescription("1..8").setRequired(true).setMinValue(1).setMaxValue(8)
      )
  )
  .addSubcommand((sc) => sc.setName("reset").setDescription("破壊記録をリセット"))
  .toJSON();

export async function handleParts(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand(true);
  const sel = { userId: i.user.id, channelId: i.channelId };

  if (sub === "show") {
    const text = await formatStatus(sel);
    await i.reply({ content: text });
    return;
  }

  if (sub === "break") {
    const no = i.options.getInteger("number", true);
    const res = await destroyPart(sel, no);
    if (!res.ok) {
      await i.reply({ content: "選択中の機体がないか、番号が不正です。", ephemeral: true });
      return;
    }
    const text = await formatStatus(sel);
    await i.reply({ content: `**${res.name}** の部位 **${no}** を破壊として記録しました。\n${text}` });
    return;
  }

  if (sub === "random") {
    const count = i.options.getInteger("count", true);
    const res = await destroyRandom(sel, count);
    if (!res.ok) {
      await i.reply({ content: "選択中の機体が見つかりません。", ephemeral: true });
      return;
    }
    const text = await formatStatus(sel);
    const picked = res.hit && res.hit.length ? ` 破壊箇所: ${res.hit.join(", ")}` : " 破壊箇所: なし";
    await i.reply({ content: `**${res.name}** にランダムで **${count}** 箇所破壊を記録しました。${picked}\n${text}` });
    return;
  }

  if (sub === "reset") {
    const res = await resetParts(sel);
    if (!res.ok) {
      await i.reply({ content: "選択中の機体が見つかりません。", ephemeral: true });
      return;
    }
    const text = await formatStatus(sel);
    await i.reply({ content: `**${res.name}** の破壊記録をリセットしました。\n${text}` });
    return;
  }
}
