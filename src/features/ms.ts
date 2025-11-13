// src/features/ms.ts
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChatInputCommandInteraction, SlashCommandBuilder,
  ButtonInteraction, EmbedBuilder, PermissionFlagsBits
} from "discord.js";

import listMechs, {
  importMech, deleteMech, selectMech,
  currentMech, formatMechSheet, mutateArmor, mutateSync, formatSync
} from "../features/mechs.js";

import { SelectionKey, Mech } from "../types.js";
import { loadUiState, saveUiState } from "../store.js";

/** /ms コマンド定義 */
export const msCommand = new SlashCommandBuilder()
  .setName("ms")
  .setDescription("機体の管理")
  .addSubcommand(sc =>
    sc.setName("import").setDescription("JSONで機体登録（```を含むJSONを貼って）")
      .addStringOption(o => o.setName("json").setDescription("機体JSON").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("list").setDescription("自分の機体一覧を表示（ボタンで選択/削除）")
  )
  .addSubcommand(sc =>
    sc.setName("select").setDescription("機体を選択（IDか名前）")
      .addStringOption(o=>o.setName("id_or_name").setDescription("ID または 名前").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("delete").setDescription("機体を削除（IDか名前）")
      .addStringOption(o=>o.setName("id_or_name").setDescription("ID または 名前").setRequired(true))
  )
  .addSubcommand(sc =>
    sc.setName("sheet").setDescription("選択中の機体シートを表示（以後、装甲変更で自動更新）")
  )
  .addSubcommand(sc =>
    sc.setName("whoami").setDescription("選択中の機体を表示")
  )
  .addSubcommandGroup(g =>
    g.setName("armor").setDescription("装甲を変更")
      .addSubcommand(sc =>
        sc.setName("add").setDescription("現在装甲に加算")
          .addIntegerOption(o=>o.setName("value").setDescription("加算値").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("sub").setDescription("現在装甲から減算")
          .addIntegerOption(o=>o.setName("value").setDescription("減算値").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("set").setDescription("現在装甲に代入（上限超え可）")
          .addIntegerOption(o=>o.setName("value").setDescription("設定値").setRequired(true))
      )
  )
  .addSubcommandGroup(g =>
    g.setName("sync").setDescription("同調率を変更（-6..+6）")
      .addSubcommand(sc =>
        sc.setName("add").setDescription("同調率を加算")
          .addIntegerOption(o=>o.setName("value").setDescription("加算するランク").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("sub").setDescription("同調率を減算")
          .addIntegerOption(o=>o.setName("value").setDescription("減算するランク").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("set").setDescription("同調率を設定（-6..+6）")
          .addIntegerOption(o=>o.setName("value").setDescription("設定ランク").setRequired(true))
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  .toJSON();

/** /ms のハンドラ */
export async function handleMs(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand(true);
  const sel: SelectionKey = { userId: i.user.id, channelId: i.channelId };

  try {
    // ---- import ----
    if (sub === "import") {
      const json = i.options.getString("json", true);
      const m = await importMech(i.user.id, json);
      await i.reply({ content: `✅ 機体を登録しました：**${m.name}**（ID: \`${m.id}\`）`, ephemeral: true });
      return;
    }

    // ---- list ----
    if (sub === "list") {
      const list: Mech[] = await listMechs(i.user.id);
      if (list.length === 0) {
        await i.reply({ content: "機体がありません。`/ms import` で登録してね。", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("あなたの機体一覧")
        .setDescription(list.map((m: Mech, idx: number) =>
          `**${idx + 1}. ${m.name}**  (ID:\`${m.id}\`)  Type:${m.type}  機動:${m.mobility}  装甲:${m.armorCurrent}/${m.armorMax}  同調率:${formatSync(m.syncLevel)}`
        ).join("\n"))
        .setColor(0x2b90d9);

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (const m of list) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`ms:select:${m.id}`).setLabel(`選択:${m.name}`).setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`ms:delete:${m.id}`).setLabel(`削除`).setStyle(ButtonStyle.Danger),
        ));
      }

      await i.reply({ embeds: [embed], components: rows, ephemeral: true });
      return;
    }

    // ---- select ----
    if (sub === "select") {
      const q = i.options.getString("id_or_name", true);
      const m = await selectMech(sel, q);
      if (!m) {
        await i.reply({ content: "該当機体が見つかりません。`/ms list` でIDを確認してね。", ephemeral: true });
        return;
      }
      await i.reply({ content: `✅ 選択中の機体：**${m.name}**（ID: \`${m.id}\`）`, ephemeral: true });
      return;
    }

    // ---- delete ----
    if (sub === "delete") {
      const q = i.options.getString("id_or_name", true);
      const ok = await deleteMech(i.user.id, q);
      await i.reply({ content: ok ? "🗑️ 削除しました。" : "削除対象が見つかりません。", ephemeral: true });
      return;
    }

    // ---- sheet ----
    if (sub === "sheet") {
      const m = await currentMech(sel);
      if (!m) {
        await i.reply({ content: "選択中の機体がありません。`/ms select` で選んでね（`/ms list`で一覧）。", ephemeral: true });
        return;
      }
      const msg = await i.reply({ content: formatMechSheet(m) });

      const ui = await loadUiState();
      ui.lastMechSheetMessageId[`${sel.channelId}:${sel.userId}`] = msg.id;
      await saveUiState(ui);
      return;
    }

    // ---- whoami ----
    if (sub === "whoami") {
      const m = await currentMech(sel);
      await i.reply({ content: m ? `選択中の機体：**${m.name}**（ID:\`${m.id}\`）` : "選択中の機体はありません。", ephemeral: true });
      return;
    }

    // ---- armor add/sub/set ----
    if (i.options.getSubcommandGroup(false) === "armor") {
      const mode = sub as "add" | "sub" | "set";
      const value = i.options.getInteger("value", true);
      const before = await currentMech(sel);
      if (!before) {
        await i.reply({ content: "選択中の機体がありません。`/ms select` で選んでね。", ephemeral: true });
        return;
      }

      const after = await mutateArmor(sel, mode, value);
      if (!after) {
        await i.reply({ content: "内部エラー：装甲変更に失敗しました。", ephemeral: true });
        return;
      }

      // シートがあれば編集
      const ui = await loadUiState();
      const msgId = ui.lastMechSheetMessageId[`${sel.channelId}:${sel.userId}`];
      try {
        if (msgId && i.channel) {
          const msg = await i.channel.messages.fetch(msgId).catch(() => null);
          if (msg) await msg.edit({ content: formatMechSheet(after) });
        }
      } catch {}

      await i.reply({
        content: `🛡️ 装甲を更新しました：**${before.armorCurrent} → ${after.armorCurrent}**（最大${after.armorMax}）`,
        ephemeral: true,
      });
      return;
    }

    // ---- sync add/sub/set ----
    if (i.options.getSubcommandGroup(false) === "sync") {
      const mode = sub as "add" | "sub" | "set";
      const value = i.options.getInteger("value", true);

      const before = await currentMech(sel);
      if (!before) {
        await i.reply({ content: "選択中の機体がありません。`/ms select` で選んでね。", ephemeral: true });
        return;
      }

      const after = await mutateSync(sel, mode, value);
      if (!after) {
        await i.reply({ content: "内部エラー：同調率変更に失敗しました。", ephemeral: true });
        return;
      }

      await i.reply({
        content: `🔗 同調率を更新しました：**${formatSync(before.syncLevel)} → ${formatSync(after.syncLevel)}**`,
        ephemeral: true,
      });
      return;
    }

  } catch (e: any) {
    const msg = (e?.message ? e.message.toString() : "不明なエラー");
    await i.reply({ content: `エラー：${msg}`, ephemeral: true }).catch(()=>{});
  }
}

/** /ms list のボタン操作 */
export async function handleMsButton(i: ButtonInteraction) {
  if (i.customId.startsWith("ms:select:")) {
    const id = i.customId.split(":")[2];
    const sel: SelectionKey = { userId: i.user.id, channelId: i.channelId! };
    const m = await selectMech(sel, id);
    await i.reply({ content: m ? `✅ 機体を選択：**${m.name}**` : "機体が見つかりません。", ephemeral: true });
    return true;
  }

  if (i.customId.startsWith("ms:delete:")) {
    const id = i.customId.split(":")[2];
    const ok = await deleteMech(i.user.id, id);
    await i.reply({ content: ok ? "🗑️ 削除しました。" : "削除対象が見つかりません。", ephemeral: true });
    return true;
  }

  return false;
}
