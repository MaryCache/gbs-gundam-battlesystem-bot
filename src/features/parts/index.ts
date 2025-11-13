import { promises as fs } from "fs";
import path from "path";
import { currentMech } from "../mechs.js";
import { SelectionKey } from "../../types.js";

/**
 * 部位管理は「選択中機体」単位で破壊状態を記録する。
 * 保存ファイル: data/parts.json
 *
 * 仕様:
 * - 部位は 1..8 を採用（1:頭部,2:左腕,3:右腕,4:左脚,5:右脚,6:左翼,7:右翼,8:コックピット）
 * - 破壊集合は number[] として持つ
 */

type PartsDB = {
  // mechId -> destroyed part numbers
  destroyed: Record<string, number[]>;
};

const DB_PATH = path.resolve("data", "parts.json");

async function loadDB(): Promise<PartsDB> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(raw) as PartsDB;
  } catch {
    return { destroyed: {} };
  }
}

async function saveDB(db: PartsDB): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export const PART_NAMES: Record<number, string> = {
  1: "【頭部】",
  2: "【左腕】",
  3: "【右腕】",
  4: "【左脚】",
  5: "【右脚】",
  6: "【左翼】",
  7: "【右翼】",
  8: "【コックピット】",
};

export async function getCurrentMechId(sel: SelectionKey): Promise<string | null> {
  const m = await currentMech(sel);
  return m?.id ?? null;
}

export async function getDestroyedParts(mechId: string): Promise<number[]> {
  const db = await loadDB();
  return (db.destroyed[mechId] ?? []).slice().sort((a, b) => a - b);
}

export async function resetParts(sel: SelectionKey): Promise<{ ok: boolean; name?: string }> {
  const m = await currentMech(sel);
  if (!m) return { ok: false };
  const db = await loadDB();
  db.destroyed[m.id] = [];
  await saveDB(db);
  return { ok: true, name: m.name };
}

export async function destroyPart(
  sel: SelectionKey,
  partNo: number
): Promise<{ ok: boolean; name?: string; updated?: number[] }> {
  if (!(partNo >= 1 && partNo <= 8)) return { ok: false };
  const m = await currentMech(sel);
  if (!m) return { ok: false };

  const db = await loadDB();
  const set = new Set(db.destroyed[m.id] ?? []);
  set.add(partNo);
  db.destroyed[m.id] = [...set];
  await saveDB(db);

  return { ok: true, name: m.name, updated: await getDestroyedParts(m.id) };
}

export async function destroyRandom(
  sel: SelectionKey,
  count: number
): Promise<{ ok: boolean; name?: string; hit?: number[]; updated?: number[] }> {
  const m = await currentMech(sel);
  if (!m) return { ok: false };

  const remain = [1, 2, 3, 4, 5, 6, 7, 8];
  const already = new Set(await getDestroyedParts(m.id));
  const candidates = remain.filter((n) => !already.has(n));
  if (candidates.length === 0) {
    return { ok: true, name: m.name, hit: [], updated: [...already].sort((a, b) => a - b) };
  }

  const picked: number[] = [];
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    picked.push(candidates.splice(idx, 1)[0]);
  }

  const db = await loadDB();
  const merged = new Set([...(db.destroyed[m.id] ?? []), ...picked]);
  db.destroyed[m.id] = [...merged];
  await saveDB(db);

  return { ok: true, name: m.name, hit: picked, updated: await getDestroyedParts(m.id) };
}

export async function formatStatus(sel: SelectionKey): Promise<string> {
  const m = await currentMech(sel);
  if (!m) return "選択中の機体がありません。`/ms select` で選んでね。";

  const broken = new Set(await getDestroyedParts(m.id));
  const lines: string[] = [];
  lines.push(`**部位状況：${m.name}**`);
  lines.push("```");
  for (let n = 1; n <= 8; n++) {
    const mark = broken.has(n) ? "×" : "○";
    lines.push(`${n}. ${PART_NAMES[n]} … ${mark}`);
  }
  lines.push("```");
  return lines.join("\n");
}
