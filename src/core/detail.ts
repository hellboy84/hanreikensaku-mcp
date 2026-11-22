/**
 * 詳細ページ（/hanrei/{ID}/detail{N}/index.html）の解析。
 * 項目はCSSのclass名ではなく、<dt>の見出し文字（「事件番号」「裁判年月日」など）で取り出す。
 */
import { parse, type HTMLElement } from 'node-html-parser';
import { DETAIL_TYPES, absoluteUrl, pdfUrl } from './site.js';
import { warekiToIso } from './wareki.js';

export interface CaseField {
  label: string;
  value: string;
}

export interface CaseAttachment {
  label: string;
  url: string;
}

export interface CaseDetail {
  id: number;
  detailType: number;
  detailTypeLabel: string;
  url: string;
  caseNumber: string;
  caseName: string;
  /** サイトの表記（和暦） */
  date: string;
  dateIso: string | null;
  /** 裁判所名（最高裁は法廷名、下級裁は部を含むことがある） */
  court: string;
  /** ページに載っている全項目（値が空のものは除く）。見出しはサイトの表記のまま */
  fields: CaseField[];
  pdfUrl: string;
  /** 全文以外のPDF（添付文書など）があれば入る */
  attachments: CaseAttachment[];
}

function cleanText(el: HTMLElement): string {
  // <br> と段落の区切りを改行として残し、それ以外の空白は1つにまとめる
  const html = el.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
  return parse(html)
    .text.split('\n')
    .map((l) => l.replace(/[\s  ]+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

export function parseDetailPage(html: string, pageUrl: string): CaseDetail {
  const m = /\/hanrei\/(\d+)\/detail(\d+)\//.exec(pageUrl);
  if (!m) throw new Error(`詳細ページのURLではありません：${pageUrl}`);
  const id = Number(m[1]);
  const detailType = Number(m[2]);

  const root = parse(html);
  const fields: CaseField[] = [];
  const attachments: CaseAttachment[] = [];
  let fullTextUrl: string | null = null;

  for (const dt of root.querySelectorAll('dt')) {
    const label = dt.text.replace(/\s+/g, ' ').trim();
    if (!label) continue;
    let dd = dt.nextElementSibling;
    while (dd && dd.tagName !== 'DD') dd = dd.nextElementSibling;
    if (!dd) continue;

    const pdfLinks = dd.querySelectorAll('a').filter((a) => /\.pdf(\?|$)/i.test(a.getAttribute('href') ?? ''));
    if (pdfLinks.length > 0) {
      for (const a of pdfLinks) {
        const url = absoluteUrl(a.getAttribute('href') ?? '', pageUrl);
        if (label === '全文' && !fullTextUrl) fullTextUrl = url;
        else attachments.push({ label: a.text.trim() || label, url });
      }
      continue;
    }
    const value = cleanText(dd);
    if (value) fields.push({ label, value });
  }

  const get = (...labels: string[]): string => {
    for (const label of labels) {
      const f = fields.find((x) => x.label === label);
      if (f) return f.value;
    }
    return '';
  };

  const caseNumber = get('事件番号');
  if (!caseNumber && !fullTextUrl) {
    throw new Error(`ID ${id} の裁判例が見つかりません（詳細ページに事件番号も全文PDFもありません）。`);
  }
  const date = get('裁判年月日');
  const courtBase = get('裁判所名・部', '裁判所名', '法廷名');
  const division = get('部名');

  return {
    id,
    detailType,
    detailTypeLabel: DETAIL_TYPES[detailType] ?? `detail${detailType}`,
    url: pageUrl,
    caseNumber,
    caseName: get('事件名'),
    date,
    dateIso: warekiToIso(date),
    court: division && !courtBase.includes(division) ? `${courtBase} ${division}` : courtBase,
    fields,
    pdfUrl: fullTextUrl ?? pdfUrl(id),
    attachments,
  };
}
