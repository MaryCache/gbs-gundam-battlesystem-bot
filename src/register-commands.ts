// src/register-commands.ts
import "dotenv/config";
import { REST, Routes } from "discord.js";

// === コマンド群を読み込む ===
import { boardCommand } from "./commands/board.js";
import { msCommand } from "./features/ms.js";
import { pcCommand } from "./commands/pc.js";
import { avoidCommand } from "./commands/avoid.js";
import { accCommand } from "./commands/acc/index.js";
import { speedCommand } from "./commands/speed/index.js";
import { partsCommand } from "./commands/parts/index.js";
// ultを使っている場合のみ有効化（未導入ならこのimportは外してください）
import { ultCommand } from "./commands/ult.js";

type Mode = "guild" | "global" | "clear:guild" | "clear:global";

const APP_ID = process.env.APP_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;
const GUILD_ID = process.env.GUILD_ID || ""; // guild系で必須

const mode = (process.argv[2] as Mode) || "global";

const commands = [
  boardCommand,
  msCommand,
  pcCommand,
  avoidCommand,
  accCommand,
  speedCommand,
  partsCommand,
  // ult を運用していない場合は下行をコメントアウト
  ultCommand,
].filter(Boolean);

function assertEnv(cond: any, message: string) {
  if (!cond) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

function banner(title: string) {
  console.log("\n" + "─".repeat(72));
  console.log(`📦 ${title}`);
  console.log("─".repeat(72));
}

async function main() {
  assertEnv(APP_ID, "APP_ID が未設定です (.env)");
  assertEnv(TOKEN, "DISCORD_TOKEN が未設定です (.env)");

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  if (mode === "guild") {
    assertEnv(GUILD_ID, "ギルド登録には GUILD_ID が必要です (.env)");

    banner("ギルドコマンド登録");
    console.log(`🪪 APP_ID: ${APP_ID}`);
    console.log(`🏷️ GUILD_ID: ${GUILD_ID}`);
    console.log(`🧩 登録コマンド数: ${commands.length}`);

    await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: commands });
    console.log("✅ ギルドへスラッシュコマンドを登録しました（通常即時反映）。");

  } else if (mode === "global") {
    banner("グローバルコマンド登録");
    console.log(`🪪 APP_ID: ${APP_ID}`);
    console.log(`🧩 登録コマンド数: ${commands.length}`);
    console.log("⏱️ 反映まで最大1時間ほどかかる場合があります。");

    await rest.put(Routes.applicationCommands(APP_ID), { body: commands });
    console.log("✅ グローバルにスラッシュコマンドを登録しました。");

  } else if (mode === "clear:guild") {
    assertEnv(GUILD_ID, "ギルド削除には GUILD_ID が必要です (.env)");
    banner("ギルドコマンド削除");
    console.log(`🪪 APP_ID: ${APP_ID}`);
    console.log(`🏷️ GUILD_ID: ${GUILD_ID}`);

    await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: [] });
    console.log("🗑️ ギルドのスラッシュコマンドを全削除しました（通常即時反映）。");

  } else if (mode === "clear:global") {
    banner("グローバルコマンド削除");
    console.log(`🪪 APP_ID: ${APP_ID}`);
    console.log("⏱️ 反映まで最大1時間ほどかかる場合があります。");

    await rest.put(Routes.applicationCommands(APP_ID), { body: [] });
    console.log("🗑️ グローバルのスラッシュコマンドを全削除しました。");

  } else {
    console.log("ℹ️ 使用方法:");
    console.log("  tsx src/register-commands.ts guild         # ギルド登録（即時）");
    console.log("  tsx src/register-commands.ts global        # グローバル登録（反映遅延あり）");
    console.log("  tsx src/register-commands.ts clear:guild   # ギルドコマンド全削除（即時）");
    console.log("  tsx src/register-commands.ts clear:global  # グローバルコマンド全削除");
    process.exit(0);
  }
}

main()
  .then(() => console.log("🎉 完了"))
  .catch((err) => {
    console.error("❌ 失敗:", err);
    process.exit(1);
  });
