import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { currentMech, syncMultiplier, formatSync } from "../../features/mechs.js";
import { SelectionKey } from "../../types.js";

/** /acc コマンド定義 */
export const accCommand = new SlashCommandBuilder()
  .setName("acc")
  .setDescription("精度指数を計算します（RANGE補正・同調率を含む）。")
  .addIntegerOption(o =>
    o.setName("level")
      .setDescription("依存技能の技能行使Lv")
      .setRequired(true)
  )
  .addNumberOption(o =>
    o.setName("base_rate")
      .setDescription("基礎精度率（％）例：120")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("range")
      .setDescription("有効射程")
      .setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName("dist")
      .setDescription("座標差量（距離）")
      .setRequired(true)
  )
  .toJSON();

/** /acc 実行処理 */
export async function handleAcc(i: ChatInputCommandInteraction) {
  const level = i.options.getInteger("level", true);
  const baseRate = i.options.getNumber("base_rate", true); // 例：120
  const range = i.options.getInteger("range", true);
  const dist  = i.options.getInteger("dist", true);

  // RANGE補正
  const delta = range - dist;
  const rangeBonus = (delta === 0) ? 20 : 0; // ジャストのみ +20%
  const accRate = baseRate - (Math.max(0, delta) * 10) + rangeBonus;

  // 素の精度指数
  const accIndexRaw = level * (accRate / 100);

  // 選択中MSの同調率を最終乗算
  const sel: SelectionKey = { userId: i.user.id, channelId: i.channelId! };
  const mech = await currentMech(sel);
  const syncLv = mech?.syncLevel ?? 0;
  const mult = syncMultiplier(syncLv);
  const accIndexFinal = accIndexRaw * mult;

  const sign = delta >= 0 ? "−" : "＋"; // 表示は全角で統一
  const absDelta = Math.abs(delta);

  // 体裁そろえ（見やすい等幅レイアウト）
  const text =
    "```\n" +
    "【精度指数の計算】\n" +
    `技能行使Lv：${level}\n` +
    `基礎精度率：${baseRate.toFixed(1)}％\n` +
    `有効射程　：${range}\n` +
    `座標差量　：${dist}\n` +
    `同調率　　：${formatSync(syncLv)}（${(mult * 100).toFixed(0)}％）\n` +
    "式の分解\n" +
    `（精度率） ＝ ${baseRate.toFixed(1)}％ ${sign} (${absDelta.toFixed(1)}×10％) ＋ ${rangeBonus.toFixed(1)}％\n` +
    `　　　　  ＝ ${accRate.toFixed(1)}％\n` +
    ` ${level} × ${(accRate / 100).toFixed(2)} ＝ ${accIndexRaw.toFixed(2)}\n` +
    `（精度指数）＝ ${accIndexRaw.toFixed(2)} × ${mult.toFixed(2)} ＝ ${accIndexFinal.toFixed(2)}\n` +
    "```";

  await i.reply({ content: text, ephemeral: false });
}
