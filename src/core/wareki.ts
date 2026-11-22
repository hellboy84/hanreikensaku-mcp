/** 和暦と西暦の変換。裁判所サイトの検索フォームは元号（令和・平成・昭和）で日付を指定する。 */

export type FormGengo = '令和' | '平成' | '昭和';

export interface WarekiDate {
  gengo: FormGengo;
  year: number;
  month: number;
  day: number;
}

interface Era {
  name: string;
  /** 元年の西暦年 */
  firstYear: number;
  /** 元号の開始日（YYYYMMDD の数値） */
  start: number;
}

const ERAS: Era[] = [
  { name: '令和', firstYear: 2019, start: 20190501 },
  { name: '平成', firstYear: 1989, start: 19890108 },
  { name: '昭和', firstYear: 1926, start: 19261225 },
  { name: '大正', firstYear: 1912, start: 19120730 },
  { name: '明治', firstYear: 1868, start: 18680125 },
];

/** 検索フォームで選べる最も古い日付（昭和元年の初日） */
export const EARLIEST_FORM_DATE = '1926-12-25';

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** "2024-03-05" を和暦に変換する。昭和より前の日付は検索フォームで選べないのでエラーにする。 */
export function isoToWareki(iso: string): WarekiDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`日付は YYYY-MM-DD の形で指定してください：${iso}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`存在しない日付です：${iso}`);
  }
  const num = y * 10000 + mo * 100 + d;
  for (const era of ERAS.slice(0, 3)) {
    if (num >= era.start) {
      return { gengo: era.name as FormGengo, year: y - era.firstYear + 1, month: mo, day: d };
    }
  }
  throw new Error(`昭和より前の日付は検索できません：${iso}`);
}

/**
 * 利用者が指定した日付を YYYY-MM-DD にそろえる。
 * "2020" や "2020-04" のように年・年月だけの指定は、範囲の始まり（from）なら初日、終わり（to）なら末日にする。
 */
export function expandDate(input: string, edge: 'from' | 'to'): string {
  const s = input.trim();
  let m = /^(\d{4})$/.exec(s);
  if (m) return edge === 'from' ? `${m[1]}-01-01` : `${m[1]}-12-31`;
  m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) throw new Error(`存在しない月です：${input}`);
    if (edge === 'from') return `${m[1]}-${pad(mo)}-01`;
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return `${m[1]}-${pad(mo)}-${pad(last)}`;
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  const fromWareki = warekiToIso(s);
  if (fromWareki) return fromWareki;
  throw new Error(`日付は YYYY-MM-DD（または YYYY、YYYY-MM）の形で指定してください：${input}`);
}

/** "令和8年8月26日" や "平成元年3月1日" を "2026-08-26" の形にする。読み取れなければ null。 */
export function warekiToIso(text: string): string | null {
  const s = text.normalize('NFKC');
  const m = /(令和|平成|昭和|大正|明治)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/.exec(s);
  if (!m) return null;
  const era = ERAS.find((e) => e.name === m[1]);
  if (!era) return null;
  const eraYear = m[2] === '元' ? 1 : Number(m[2]);
  const year = era.firstYear + eraYear - 1;
  return `${pad(year, 4)}-${pad(Number(m[3]))}-${pad(Number(m[4]))}`;
}
