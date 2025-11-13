// src/features/mechs.ts
import crypto from "crypto";
import {
  loadMechDB,
  saveMechDB,
  loadSelections,
  saveSelections,
} from "../store.js";
import { Mech, MechType, ImportedMechJSON, SelectionKey } from "../types.js";

/* ===== 同調率（ランク→倍率） ===== */
const SYNC_TABLE: Record<number, number> = {
  6: 4.0, 5: 3.5, 4: 3.0, 3: 2.5, 2: 2.0, 1: 1.5, 0: 1.0,
  [-1]: 2/3, [-2]: 0.5, [-3]: 0.4, [-4]: 2/6, [-5]: 2/7, [-6]: 0.25,
};

export function syncMultiplier(lv: number): number {
  const n = Math.max(-6, Math.min(6, Math.trunc(lv)));
  return SYNC_TABLE[n] ?? 1.0;
}
export function formatSync(lv: number): string {
  const mult = syncMultiplier(lv);
  const sign = lv > 0 ? `+${lv}` : `${lv}`;
  return `${sign}（${(mult * 100).toFixed(0)}％）`;
}

/** 一覧（ownerのものを古い順） */
export default async function listMechs(ownerId: string): Promise<Mech[]> {
  const db = await loadMechDB();
  const list = Array.isArray(db.mechs) ? db.mechs : [];
  return list.filter(m => m.ownerId === ownerId).sort((a,b)=>a.createdAt-b.createdAt);
}

/** 取り込み */
export async function importMech(ownerId: string, jsonStr: string): Promise<Mech> {
  const parsed = safeParse<ImportedMechJSON>(jsonStr, "JSON形式が不正です。`{ \"機体\": { ... } }` を貼ってください。");
  if (!parsed.機体) throw new Error("キー `機体` がありません。");

  const name = str(parsed.機体.名前, "名前");
  const type = oneOf<MechType>(parsed.機体.Type, ["F","S","E"], "Type");
  const TLv = toInt(parsed.機体.TLv, "TLv");
  const mobility = toInt(parsed.機体.機動, "機動");
  const armor = toInt(parsed.機体.装甲, "装甲");
  const load = toInt(parsed.機体.積載, "積載");

  const mech: Mech = {
    id: crypto.randomUUID(),
    ownerId,
    name,
    type,
    TLv,
    mobility,
    armorMax: armor,
    armorCurrent: armor,
    load,
    syncLevel: 0, // 初期値0
    createdAt: Date.now(),
  };

  const db = await loadMechDB();
  if (!Array.isArray(db.mechs)) db.mechs = [];
  db.mechs.push(mech);
  await saveMechDB(db);
  return mech;
}

/** 削除（id or name） */
export async function deleteMech(ownerId: string, idOrName: string): Promise<boolean> {
  const db = await loadMechDB();
  if (!Array.isArray(db.mechs)) db.mechs = [];
  const before = db.mechs.length;
  db.mechs = db.mechs.filter(m => !(m.ownerId === ownerId && (m.id === idOrName || m.name === idOrName)));
  const changed = db.mechs.length !== before;
  if (changed) await saveMechDB(db);
  return changed;
}

/** 選択（チャンネル×ユーザーに紐づく） */
export async function selectMech(sel: SelectionKey, idOrName: string): Promise<Mech | null> {
  const db = await loadMechDB();
  const s = await loadSelections();
  const found = (db.mechs ?? []).find(m => m.ownerId === sel.userId && (m.id === idOrName || m.name === idOrName));
  if (!found) return null;
  const key = `${sel.channelId}:${sel.userId}`;
  s.mech[key] = found.id;
  await saveSelections(s);
  return found;
}

/** 現在選択中を取得 */
export async function currentMech(sel: SelectionKey): Promise<Mech | null> {
  const s = await loadSelections();
  const db = await loadMechDB();
  const key = `${sel.channelId}:${sel.userId}`;
  const id = s.mech[key];
  if (!id) return null;
  return (db.mechs ?? []).find(m => m.id === id) ?? null;
}

/** シート出力（同調率は表示しない） */
export function formatMechSheet(m: Mech): string {
  const lines: string[] = [];
  lines.push(`## ${m.name}`);
  lines.push("─=≡STATUS≡=─");
  lines.push("```");
  lines.push(`Type：${m.type}`);
  lines.push(`TLv ：${m.TLv}`);
  lines.push(`機動：${m.mobility}`);
  lines.push(`装甲：${m.armorCurrent}／${m.armorMax}`);
  lines.push(`積載：${m.load}`);
  lines.push("```");
  return lines.join("\n");
}

/** 装甲操作：mode=add|sub|set */
export async function mutateArmor(
  sel: SelectionKey,
  mode: "add" | "sub" | "set",
  value: number
): Promise<Mech | null> {
  const s = await loadSelections();
  const db = await loadMechDB();
  const key = `${sel.channelId}:${sel.userId}`;
  const id = s.mech[key];
  if (!id) return null;
  const m = (db.mechs ?? []).find(x => x.id === id);
  if (!m) return null;

  const v = Math.trunc(Number(value) || 0);
  if (mode === "add") m.armorCurrent += v;
  else if (mode === "sub") m.armorCurrent -= v;
  else m.armorCurrent = v;

  await saveMechDB(db);
  return m;
}

/** 同調率操作：mode=add|sub|set（-6..+6にクランプ） */
export async function mutateSync(
  sel: SelectionKey,
  mode: "add" | "sub" | "set",
  value: number
): Promise<Mech | null> {
  const s = await loadSelections();
  const db = await loadMechDB();
  const key = `${sel.channelId}:${sel.userId}`;
  const id = s.mech[key];
  if (!id) return null;
  const m = (db.mechs ?? []).find(x => x.id === id);
  if (!m) return null;

  const v = Math.trunc(Number(value) || 0);
  if (mode === "add") m.syncLevel += v;
  else if (mode === "sub") m.syncLevel -= v;
  else m.syncLevel = v;

  m.syncLevel = Math.max(-6, Math.min(6, m.syncLevel));
  await saveMechDB(db);
  return m;
}

/* ===== プロパティ問い合わせ ===== */

export function matchMechPropQuery(content: string): "Type"|"TLv"|"機動"|"装甲"|"積載"|"同調率"|null {
  const cleaned = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\r?\n/g, " ");
  const t = cleaned.replace(/^[\s\u3000]+|[\s\u3000]+$/g, "");
  const normalized = t.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  const lower = normalized.toLowerCase();

  if (/^(type)$/.test(lower)) return "Type";
  if (/^tlv$/.test(lower)) return "TLv";
  if (/^(機動)$/.test(t)) return "機動";
  if (/^(装甲)$/.test(t)) return "装甲";
  if (/^(積載)$/.test(t)) return "積載";
  if (/^(同調率)$/.test(t)) return "同調率";
  return null;
}

export async function answerMechProp(sel: SelectionKey, prop: ReturnType<typeof matchMechPropQuery>): Promise<string> {
  const m = await currentMech(sel);
  if (!m) return "（このチャンネルで選択中の機体がありません。`/ms select` を実行してね）";
  switch (prop) {
    case "Type": return `Type：**${m.type}**`;
    case "TLv": return `TLv：**${m.TLv}**`;
    case "機動": return `機動：**${m.mobility}**`;
    case "装甲": return `装甲：**${m.armorCurrent}／${m.armorMax}**`;
    case "積載": return `積載：**${m.load}**`;
    case "同調率": return `同調率：**${formatSync(m.syncLevel)}**`;
    default: return "";
  }
}

/* ===== ユーティリティ ===== */
function safeParse<T>(j: string, msg: string): T {
  try { return JSON.parse(j) as T; } catch { throw new Error(msg); }
}
function str(v: unknown, label: string): string {
  if (typeof v !== "string") throw new Error(`\`${label}\` は文字列で指定してください。`);
  return v.trim();
}
function toInt(v: unknown, label: string): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`\`${label}\` は数値です。`);
  return Math.trunc(n as number);
}
function oneOf<T extends string>(v: unknown, set: readonly T[], label: string): T {
  if (typeof v !== "string" || !set.includes(v as T)) throw new Error(`\`${label}\` は ${set.join("|")} から選んでください。`);
  return v as T;
}
