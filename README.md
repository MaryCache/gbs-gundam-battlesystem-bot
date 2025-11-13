# G.B.S – Gundam Battle System (Discord Bot)

ガンダムTRPGの戦闘と管理を自動化する Discord Bot。  
技能判定/機体シート/同調率/部位破壊/行動盤面の入力共有など、卓運用を省力化します。

## ✨ Features
- **行動盤面**: `/board create|add|mode|sheet` + セレクトUIで座標/ARTS/対象を予約、公開、確定
- **精度計算**: `/acc`（RANGE補正 & 同調率 × 乗算）
- **速度計算**: `/speed`（表記はコード参照）
- **回避計算**: `/avoid`
- **機体管理**: `/ms import|list|select|sheet|armor ...` + 自然文「機動」「装甲」返信
- **部位破壊**: `/parts show|break|random|reset`（※機体ごとに記録）
- **ULT**: `/ult on|off|toggle|status`（キャラ毎の入力予約と同列で扱える設計）

## 🧱 Tech
- Node.js + TypeScript / discord.js v14
- データ永続: JSON/SQLite（モジュール構成に依存）
- ツール: pnpm or npm / tsx / dotenv

## 🚀 Quick Start

1. **Discord Developer Portal** で Bot 作成、Privileged Intents を必要に応じてON  
   （Presence/Members/Message Content 等）
2. `.env` を作成（`.env.example` をコピー）
3. 依存インストール & ビルド
   ```
   npm i
   npm run build
   ```
4. 起動
   ```
   npm run start
   ```
5. スラッシュコマンド登録/削除
   ```
   npm run register:guild（高速反映/テスト向け）
   npm run register:global（グローバル登録/数分～最長1時間の伝播遅延あり）
   npm run unregister:guild（ギルドコマンド削除）
   ```