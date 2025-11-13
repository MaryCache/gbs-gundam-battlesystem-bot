import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ButtonInteraction,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import {
  createBoard,
  loadBoard,
  saveBoard,
  addParticipant,
  removeParticipant,
  setMove,
  setReservationFields,
  commitAll,
  renderBoard,
} from "../features/board.js";
import { BoardMode } from "../types.js";

/* ===== 選択状態（チャンネル×ユーザー）を一時保持 ===== */
type SelectState = { memberId?: string; pos?: number; artsNo?: number; targetId?: string | null };
const selections = new Map<string, SelectState>();
const keyOf = (channelId: string, userId: string) => `${channelId}:${userId}`;

/* 盤面メッセージを更新（なければ作る） */
async function upsertBoardMessage(
  channel: TextChannel,
  st: Awaited<ReturnType<typeof loadBoard>>
) {
  if (!st) return;
  const ui = renderBoard(st);
  if (st.lastMessageId) {
    try {
      const msg = await channel.messages.fetch(st.lastMessageId);
      await msg.edit({ embeds: [ui.embed], components: ui.components });
      return;
    } catch {
      /* 取得できなければ新規送信へフォールバック */
    }
  }
  const sent = await channel.send({ embeds: [ui.embed], components: ui.components });
  st.lastMessageId = sent.id;
  await saveBoard(st);
}

/** 全員 tmp 入力済みの内容を要約して、盤面チャンネルへ公開送信する */
async function publishToSameChannel(channel: TextChannel) {
  const st = await loadBoard(channel.id);
  if (!st) return;

  const lines: string[] = [];
  for (const m of st.members) {
    if (m.tmp == null) continue; // 入力未完は除外
    const before = (m.pos ?? "-");
    const after = m.tmp;
    const arts = (m.tmpArtsNo ?? 0);

    let targetStr = "なし";
    if (m.tmpTargetId !== undefined) {
      if (m.tmpTargetId === null) targetStr = "なし";
      else {
        const t = st.members.find(x => x.id === m.tmpTargetId);
        targetStr = t?.name ?? "(不明)";
      }
    }
    const ultStr = m.tmpUlt ? " ／ ULT ON" : "";
    lines.push(`${m.name}：${before} → ${after} ／ ARTS.No.${arts} ／ 対象 ${targetStr}${ultStr}`);
  }
  if (lines.length === 0) return;

  const embed = new EmbedBuilder()
    .setTitle("行動公開")
    .setDescription("```\n" + lines.join("\n") + "\n```")
    .setColor(0xffc107);

  await channel.send({ embeds: [embed] });
}

/* ========== スラッシュコマンド定義 ========== */
export const boardCommand = new SlashCommandBuilder()
  .setName("board")
  .setDescription("座標盤面の作成/操作")
  .addSubcommand((sc) =>
    sc
      .setName("create")
      .setDescription("盤面を作成（1チャンネルに1つ）")
      .addIntegerOption((o) =>
        o
          .setName("size")
          .setDescription("マス数（1～25）")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(25)
      )
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("モード（free/battle）")
          .addChoices({ name: "free", value: "free" }, { name: "battle", value: "battle" })
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("add")
      .setDescription("参加者を追加")
      .addStringOption((o) => o.setName("name").setDescription("名前").setRequired(true))
  )
  .addSubcommand((sc) =>
    sc
      .setName("remove")
      .setDescription("参加者を削除（IDまたは名前）")
      .addStringOption((o) =>
        o.setName("id_or_name").setDescription("ID または 名前").setRequired(true)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("mode")
      .setDescription("モードを切り替え")
      .addStringOption((o) =>
        o
          .setName("value")
          .setDescription("free/battle")
          .setRequired(true)
          .addChoices({ name: "free", value: "free" }, { name: "battle", value: "battle" })
      )
  )
  .addSubcommand((sc) => sc.setName("sheet").setDescription("盤面を表示/更新"))
  .toJSON();

/* ========== /board 実行 ========== */
export async function handleBoard(i: ChatInputCommandInteraction) {
  const sub = i.options.getSubcommand(true);
  const channelId = i.channelId;
  const channel = i.channel as TextChannel;

  if (sub === "create") {
    const size = Math.max(1, Math.min(25, i.options.getInteger("size", true)));
    const mode = (i.options.getString("mode") as BoardMode | null) ?? "free";
    const st = await createBoard(channelId, i.user.id, size, mode);

    const ui = renderBoard(st);
    await i.reply({ embeds: [ui.embed], components: ui.components, withResponse: true });
    const sent = await i.fetchReply();
    st.lastMessageId = (sent as any).id;
    await saveBoard(st);
    return;
  }

  const st0 = await loadBoard(channelId);
  if (!st0) {
    await i.reply({ content: "まだ盤面がありません。`/board create` から。", flags: 64 });
    return;
  }

  if (sub === "add") {
    const name = i.options.getString("name", true);
    await addParticipant(channelId, name);
    const st = await loadBoard(channelId);
    await i.reply({ content: `追加: **${name}**`, flags: 64 });
    await upsertBoardMessage(channel, st);
    return;
  }

  if (sub === "remove") {
    const q = i.options.getString("id_or_name", true);
    const ok = await removeParticipant(channelId, q);
    await i.reply({ content: ok ? "削除しました。" : "削除対象が見つかりません。", flags: 64 });
    await upsertBoardMessage(channel, await loadBoard(channelId));
    return;
  }

  if (sub === "mode") {
    const value = i.options.getString("value", true) as BoardMode;
    st0.mode = value;
    await saveBoard(st0);
    await i.reply({ content: `モードを **${value}** にしました。`, flags: 64 });
    await upsertBoardMessage(channel, await loadBoard(channelId));
    return;
  }

  if (sub === "sheet") {
    await i.reply({ content: "盤面を更新しました。", flags: 64 });
    await upsertBoardMessage(channel, st0);
    return;
  }
}

/* ========== ボタン/セレクトのハンドリング ========== */
export async function handleBoardComponent(i: ButtonInteraction | any) {
  const channelId = i.channelId;
  const channel = i.channel as TextChannel;
  const st = await loadBoard(channelId);
  if (!st) {
    await i.reply({ content: "盤面がありません。`/board create` から。", flags: 64 });
    return true;
  }
  const k = keyOf(channelId, i.user.id);
  const sel = selections.get(k) ?? {};
  selections.set(k, sel);

  // セレクト：参加者
  if (i.isStringSelectMenu() && i.customId === "board:select-member") {
    sel.memberId = i.values[0];
    selections.set(k, sel);
    await i.deferUpdate();
    return true;
  }
  // セレクト：座標
  if (i.isStringSelectMenu() && i.customId === "board:select-pos") {
    sel.pos = parseInt(i.values[0], 10);
    selections.set(k, sel);
    await i.deferUpdate();
    return true;
  }
  // セレクト：ARTS.No
  if (i.isStringSelectMenu() && i.customId === "board:select-arts") {
    sel.artsNo = parseInt(i.values[0], 10);
    selections.set(k, sel);
    await i.deferUpdate();
    return true;
  }
  // セレクト：対象
  if (i.isStringSelectMenu() && i.customId === "board:select-target") {
    const v = i.values[0];
    sel.targetId = (v === "none") ? null : v;
    selections.set(k, sel);
    await i.deferUpdate();
    return true;
  }

  // ボタン：確定（/ult で予約済みの tmpUlt は維持）
  if (i.isButton() && i.customId === "board:confirm") {
    if (!sel.memberId || typeof sel.pos !== "number") {
      await i.reply({ content: "キャラと座標を選んでから押してね。", flags: 64 });
      return true;
    }
    await setMove(channelId, sel.memberId, sel.pos);
    await setReservationFields(channelId, sel.memberId, {
      artsNo: sel.artsNo ?? 0,
      targetId: sel.targetId ?? undefined,
      // ult は /ult 側で設定済みなら undefined を渡して上書きしない
    });

    if (st.mode === "battle") {
      const latest = (await loadBoard(channelId))!;
      const name =
        latest.members.find((m: any) => m.id === sel.memberId)?.name ?? "(不明)";
      const targetName =
        sel.targetId == null
          ? (sel.targetId === null ? "なし" : "未選択")
          : (latest.members.find((m: any) => m.id === sel.targetId)?.name ?? "(不明)");
      const ultFlag = latest.members.find((m:any)=>m.id===sel.memberId)?.tmpUlt ?? false;
      const ultStr = ultFlag ? " ／ ULT ON" : "";
      await i.reply({
        content: `入力を受け付けました：**${name}** → 座標 **${sel.pos}** ／ ARTS.No **${sel.artsNo ?? 0}** ／ 対象 **${targetName}**${ultStr}`,
        flags: 64,
      });

      const allReady =
        latest.members.length > 0 && latest.members.every((m: any) => m.tmp != null);
      if (allReady) {
        await publishToSameChannel(channel);
        await commitAll(channelId);
        await upsertBoardMessage(channel, await loadBoard(channelId));
      } else {
        await upsertBoardMessage(channel, latest);
      }
    } else {
      await i.deferUpdate();
      await upsertBoardMessage(channel, await loadBoard(channelId));
    }
    return true;
  }

  // ボタン：表示/更新
  if (i.isButton() && i.customId === "board:publish") {
    await i.deferUpdate();
    await upsertBoardMessage(channel, await loadBoard(channelId));
    return true;
  }

  // ボタン：削除
  if (i.isButton() && i.customId === "board:delete") {
    if (!sel.memberId) {
      await i.reply({ content: "削除するキャラを選んでね。", flags: 64 });
      return true;
    }
    const ok = await removeParticipant(channelId, sel.memberId);
    await i.reply({ content: ok ? "削除しました。" : "削除対象が見つかりません。", flags: 64 });
    selections.set(k, { pos: sel.pos });
    await upsertBoardMessage(channel, await loadBoard(channelId));
    return true;
  }

  return false;
}
