/**
 * PDFから文字を取り出し、座標をもとに「行」にまとめる。
 *
 * 平成期以前のPDFは、フォントを埋め込まずに既定の文字対応表（CMap。90msp-RKSJ-H など）を
 * 参照しているものが多い。CMapを渡さないと文字が1つも取り出せないので、cmapLoader を必ず渡すこと。
 */
import { getDocumentProxy } from 'unpdf';

/** CMapファイル（例："90msp-RKSJ-H.bcmap"）の中身を返す関数。置き場所は実行環境ごとに違う。 */
export type CMapLoader = (filename: string) => Promise<Uint8Array>;

export interface PdfLine {
  text: string;
  /** 行の左端・右端（PDFの座標。単位はポイント） */
  left: number;
  right: number;
  /** 行の基準線の高さ（下端が0） */
  y: number;
  /** 文字の大きさ（ポイント） */
  size: number;
  /**
   * 行の先頭が、本文から離れた半角数字だけのかたまりである場合の情報。
   * 左の余白に振られた行番号（5, 10, 15…）を見分けるために使う。
   */
  lead?: { value: number; x: number; restText: string; restLeft: number };
}

export interface PdfPage {
  number: number;
  width: number;
  height: number;
  lines: PdfLine[];
}

interface Item {
  str: string;
  x: number;
  y: number;
  width: number;
  size: number;
}

export async function extractPdfPages(data: Uint8Array, cmapLoader?: CMapLoader): Promise<PdfPage[]> {
  class BinaryDataFactory {
    async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
      if (kind !== 'cMapUrl' || !cmapLoader) throw new Error(`not available: ${kind}/${filename}`);
      return cmapLoader(filename);
    }
  }

  // pdf.js は渡したバッファを取り込んでしまうので、コピーを渡す
  const pdf = await getDocumentProxy(new Uint8Array(data), {
    BinaryDataFactory,
    cMapUrl: 'cmaps/',
    cMapPacked: true,
    useWorkerFetch: false,
    verbosity: 0,
  } as Parameters<typeof getDocumentProxy>[1]);

  try {
    const pages: PdfPage[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const raw of content.items as Array<Record<string, unknown>>) {
        if (typeof raw.str !== 'string' || !Array.isArray(raw.transform)) continue;
        const t = raw.transform as number[];
        const size = Math.hypot(t[2] ?? 0, t[3] ?? 0) || Number(raw.height) || 0;
        items.push({
          str: raw.str,
          x: t[4] ?? 0,
          y: t[5] ?? 0,
          width: Number(raw.width) || 0,
          size,
        });
      }
      pages.push({ number: n, width: viewport.width, height: viewport.height, lines: groupIntoLines(items) });
      page.cleanup();
    }
    stripMarginLineNumbers(pages);
    return pages;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** 同じ高さにある文字のかたまりを、左から順につないで1行にする */
export function groupIntoLines(items: Item[]): PdfLine[] {
  const visible = items.filter((i) => i.str.length > 0);
  // 上から下へ、同じ高さなら左から右へ
  visible.sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: Item[][] = [];
  for (const item of visible) {
    const last = groups[groups.length - 1];
    const ref = last?.find((i) => i.str.trim().length > 0) ?? last?.[0];
    const tolerance = Math.max(2, (ref?.size || item.size || 10) * 0.45);
    if (last && ref && Math.abs(ref.y - item.y) <= tolerance) last.push(item);
    else groups.push([item]);
  }

  const lines: PdfLine[] = [];
  for (const group of groups) {
    group.sort((a, b) => a.x - b.x);
    const solid = group.filter((i) => i.str.trim().length > 0);
    if (solid.length === 0) continue;
    const size = Math.max(...solid.map((i) => i.size)) || 10;

    // 文字のかたまりをつなぐ。間に空白を入れるかどうかは、実際のすき間の幅で決める。
    // Wordなどは和文と半角英数字の間を自動で少し（約1/4文字）空けるが、これは空白ではないので入れない
    // （入れると「令和 6 年 2 月」のようになる）。英単語どうしの間は、狭くても空白として扱う。
    const isAscii = (ch: string | undefined) => ch !== undefined && ch.charCodeAt(0) < 0x80;
    const join = (parts: Item[]): string => {
      let text = '';
      let prevRight: number | null = null;
      let sawSpace = false;
      for (const item of parts) {
        if (item.str.trim().length === 0) {
          sawSpace = true;
          continue;
        }
        // 文字列の先頭に空白の文字そのものが入っている場合は、すき間の幅によらず空白とする
        const str = item.str.replace(/^\s+/, '');
        const leadingSpace = str.length !== item.str.length;
        if (prevRight !== null && text && !text.endsWith(' ')) {
          const gap = item.x - prevRight;
          const bothAscii = isAscii(text[text.length - 1]) && isAscii(str[0]);
          const wide = gap > size * 0.42;
          if (leadingSpace || wide || (bothAscii && sawSpace && gap > size * 0.1)) text += ' ';
        }
        text += str;
        prevRight = item.x + item.width;
        sawSpace = /\s$/.test(str);
      }
      return text.trim();
    };

    const first = solid[0]!;
    const right = Math.max(...solid.map((i) => i.x + i.width));
    const line: PdfLine = { text: join(group), left: first.x, right, y: first.y, size };

    const second = solid[1];
    const leadText = first.str.trim();
    if (/^\d{1,3}$/.test(leadText) && (!second || second.x - (first.x + first.width) > size * 0.9)) {
      const rest = group.slice(group.indexOf(first) + 1);
      line.lead = {
        value: Number(leadText),
        x: first.x + first.width,
        restText: join(rest),
        restLeft: second?.x ?? first.x,
      };
    }
    lines.push(line);
  }
  return lines;
}

/**
 * 左の余白に振られた行番号（5, 10, 15, 20, 25…）を本文から取り除く。
 * 知財事件や東京地裁の判決などで使われている。文書全体で同じ位置に5の倍数が
 * 繰り返し現れる場合だけ、行番号とみなす。
 */
export function stripMarginLineNumbers(pages: PdfPage[]): void {
  const candidates = pages.flatMap((p) => p.lines.filter((l) => l.lead && l.lead.value % 5 === 0 && l.lead.value > 0));
  if (candidates.length < 4) return;
  // 行番号は右ぞろえで振られるので、数字の右端の位置でそろっているかを見る
  const xs = candidates.map((l) => l.lead!.x).sort((a, b) => a - b);
  const median = xs[Math.floor(xs.length / 2)]!;
  const aligned = candidates.filter((l) => Math.abs(l.lead!.x - median) <= 6);
  if (aligned.length < 4 || aligned.length < candidates.length * 0.6) return;

  const bodyLeft = Math.min(
    ...pages.flatMap((p) => p.lines.filter((l) => !l.lead && l.text.length > 10).map((l) => l.left)),
  );
  if (!(median < bodyLeft)) return;

  for (const page of pages) {
    const kept: PdfLine[] = [];
    for (const line of page.lines) {
      const lead = line.lead;
      if (lead && lead.value % 5 === 0 && Math.abs(lead.x - median) <= 6) {
        if (lead.restText) kept.push({ text: lead.restText, left: lead.restLeft, right: line.right, y: line.y, size: line.size });
        // 行番号だけの行（空行に振られた番号）は捨てる
      } else {
        kept.push(line);
      }
    }
    page.lines = kept;
  }
}
