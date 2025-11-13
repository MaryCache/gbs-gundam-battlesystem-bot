// src/bot.ts — 全文
import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} from "discord.js";

import { pcCommand, handlePc, handlePcButton } from "./commands/pc.js";
import { trySkillRoll } from "./features/characters.js";
import { msCommand, handleMs, handleMsButton } from "./features/ms.js";
import { matchMechPropQuery, answerMechProp } from "./features/mechs.js";
import { avoidCommand, handleAvoid } from "./commands/avoid.js";
import { boardCommand, handleBoard, handleBoardComponent } from "./commands/board.js";
import { accCommand, handleAcc } from "./commands/acc/index.js";
import { speedCommand, handleSpeed } from "./commands/speed/index.js";
import { partsCommand, handleParts } from "./commands/parts/index.js";
import { ultCommand, handleUlt } from "./commands/ult.js"; // ← 追加

const token = process.env.DISCORD_TOKEN!;
const appId = process.env.APP_ID!;
if (!token || !appId) {
  console.error("DISCORD_TOKEN / APP_ID が未設定");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // 既存のメッセージ反応（技能・機体プロパティ）用
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log("ℹ️  Slashコマンドはグローバル登録運用です。変更時は `npm run register` を実行してください。");
});

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === "pc")    return handlePc(i);
      if (i.commandName === "ms")    return handleMs(i);
      if (i.commandName === "avoid") return handleAvoid(i);
      if (i.commandName === "board") return handleBoard(i);
      if (i.commandName === "acc")   return handleAcc(i);
      if (i.commandName === "speed") return handleSpeed(i);
      if (i.commandName === "parts") return handleParts(i);
      if (i.commandName === "ult")   return handleUlt(i); // ← 追加
      return;
    }
    if (i.isButton() || i.isStringSelectMenu()) {
      if (await handlePcButton(i as any))       return;
      if (await handleMsButton(i as any))       return;
      if (await handleBoardComponent(i as any)) return;
    }
  } catch (e) {
    console.error(e);
  }
});

// 既存のメッセージ反応（技能・機体プロパティ）
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  const prop = matchMechPropQuery(msg.content);
  if (prop) {
    const text = await answerMechProp(
      { userId: msg.author.id, channelId: msg.channelId },
      prop
    );
    await msg.reply({ content: text });
    return;
  }

  const res = await trySkillRoll(msg.content, {
    userId: msg.author.id,
    channelId: msg.channelId,
  });
  if (!res) return;
  await msg.reply({ content: res.error ? res.error : "```\n" + res.text + "\n```" });
});

client.login(token);
