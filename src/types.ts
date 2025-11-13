// src/types.ts — 全文

/* ===== キャラ ===== */

export type Ability = "身体" | "精神" | "器用" | "知性" | "五感" | "外見";

export type Skill =
  | "機動制御" | "近接剣術" | "精密射撃" | "危機感知"
  | "整備" | "機械操作" | "応急処置" | "索敵" | "通信管制" | "白兵戦"
  | "戦場耐性" | "冷静沈着" | "精神分析"
  | "説得" | "威圧" | "魅了" | "洞察" | "欺瞞" | "演説";

export const ALL_SKILLS: Skill[] = [
  "機動制御","近接剣術","精密射撃","危機感知",
  "整備","機械操作","応急処置","索敵","通信管制","白兵戦",
  "戦場耐性","冷静沈着","精神分析",
  "説得","威圧","魅了","洞察","欺瞞","演説"
];

export interface ImportedCharacterJSON {
  基本情報: { 名前: string; 性別?: string; 年齢?: string | number };
  能力値: Record<Ability, number>;
  技能: Record<Skill, number>;
}

export interface Character {
  id: string;
  ownerId: string;      // Discord userId
  name: string;
  gender?: string;
  age?: string;
  abilities: Record<Ability, number>;
  skills: Record<Skill, number>;
  createdAt: number;
}

export interface SelectionKey {
  userId: string;
  channelId: string;
}

/* ===== 機体 ===== */

export type MechType = "F" | "S" | "E";

export interface ImportedMechJSON {
  機体: {
    名前: string;
    Type: MechType;
    TLv: number;
    機動: number;
    装甲: number;
    積載: number;
    // 同調率はインポート省略可（常に0初期化）
  };
}

export interface Mech {
  id: string;
  ownerId: string;        // Discord userId
  name: string;
  type: MechType;         // F/S/E
  TLv: number;
  mobility: number;       // 機動
  armorMax: number;       // 装甲(最大)
  armorCurrent: number;   // 装甲(現在)
  load: number;           // 積載
  /** 同調率ランク（-6..+6、計算時は倍率化） */
  syncLevel: number;
  createdAt: number;
}

/* ===== 盤面（Board） ===== */

export type BoardMode = "free" | "battle";

export interface BoardParticipant {
  id: string;            // 内部ID（uuid 等）
  name: string;          // 表示名
  /** 最終確定座標（未配置は null） */
  pos: number | null;
  /** battle モードで確定前の一時入力（未入力は null） */
  tmp: number | null;
  /** SELECT PHASE で予約された ARTS.No（未入力は undefined、0=不使用、null は「なし」を明示） */
  tmpArtsNo?: number | null;
  /** 予約された対象（参加者 id）。未入力は undefined、null は「なし」 */
  tmpTargetId?: string | null;
  /** 予約された ULT 状態（未設定は undefined） */
  tmpUlt?: boolean;
}

export interface BoardState {
  channelId: string;     // 1ch に 1 盤面
  ownerId: string;       // /board create 実行者
  size: number;          // マス数（1..size）
  mode: BoardMode;       // free / battle
  members: BoardParticipant[];
  /** 最新盤面メッセージID（任意） */
  lastMessageId?: string;
  createdAt: number;
}
