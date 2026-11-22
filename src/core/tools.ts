/**
 * MCPツールの定義。ローカル（stdio）とリモート（HTTP）で同じものを登録する。
 * ツールの名前と入出力は、フェーズ2でも同じ形を保つ。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { HanreiService } from './service.js';
import { CATEGORIES, CATEGORY_KEYS, DETAIL_TYPES, PAGE_SIZE } from './site.js';
import { renderText, type JudgmentText } from './text.js';

export const SERVER_NAME = 'hanreikensaku-mcp';
export const SERVER_VERSION = '0.1.0';

export const DEFAULT_MAX_CHARS = 12_000;
export const MAX_MAX_CHARS = 40_000;

const INSTRUCTIONS = `裁判所ウェブサイトの「裁判例検索」 https://www.courts.go.jp/hanrei/search1/index.html を検索・取得するサーバーです。
使い方：search_cases で検索 → get_case でメタデータ（判示事項・裁判要旨など）→ get_full_text で本文。
注意：
- このサイトには全ての裁判例が載っているわけではありません。「見つからない」は「存在しない」を意味しません。
- 当事者名などは「A」「B」等に置き換えられていることがあります。
- 本文はPDFから機械的に取り出したものです。図表は含まれず、外字は「・」になっていることがあります。正確な引用が必要な場合は pdf_url の原文を確認するよう利用者に伝えてください。
- サイトへの負担を避けるため、アクセスは1回ごとに数秒の間隔を空けています（取得済みのものはキャッシュから返します）。`;

function categoryHelp(): string {
  return CATEGORY_KEYS.map((k) => `${k}＝${CATEGORIES[k].label}`).join('、');
}

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 1) }] };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: 'text' as const, text: `エラー：${message}` }] };
}

function outline(doc: JudgmentText): string[] {
  const MAX = 60;
  const lines = doc.sections.slice(0, MAX).map((s) => {
    const pages = s.pageFrom === s.pageTo ? `${s.pageFrom}頁` : `${s.pageFrom}〜${s.pageTo}頁`;
    return `${'  '.repeat(s.level - 1)}[${s.index}] ${s.title}（${pages}、${s.chars.toLocaleString('ja-JP')}字）`;
  });
  if (doc.sections.length > MAX) lines.push(`（ほか ${doc.sections.length - MAX} 件の見出し）`);
  return lines;
}

export function registerTools(server: McpServer, service: HanreiService): void {
  server.registerTool(
    'search_cases',
    {
      title: '裁判例を検索',
      description: `裁判所ウェブサイトの裁判例検索で裁判例を探し、一覧（ID、事件番号、事件名、裁判年月日、裁判所など）を返す。1回に最大${PAGE_SIZE}件。続きは offset で取得する。条件は少なくとも1つ必要。注意：全文検索（keywords）の該当が全区分の合計で2,000件を超えると、サイトは結果を返さずエラーになる（「損害賠償」「憲法」「契約」のような一般的な語。期間・裁判所・区分で絞っても解消しない）。その場合は、より具体的な語にするか keywords_and で語を追加する。`,
      inputSchema: {
        keywords: z
          .string()
          .optional()
          .describe('全文検索の語。スペースで区切ると「いずれかを含む」（OR）になる。例：「安全配慮義務」'),
        keywords_and: z
          .string()
          .optional()
          .describe('keywords の結果を、さらにこの語を含むものに絞る（AND）。例：keywords=安全配慮義務、keywords_and=過労死'),
        category: z
          .enum(CATEGORY_KEYS as [string, ...string[]])
          .optional()
          .describe(`検索する区分。省略時は all。${categoryHelp()}`),
        date_from: z
          .string()
          .optional()
          .describe('裁判年月日の範囲の始め。西暦で YYYY-MM-DD（YYYY、YYYY-MM も可）。昭和以降のみ'),
        date_to: z.string().optional().describe('裁判年月日の範囲の終わり。西暦で YYYY-MM-DD（YYYY、YYYY-MM も可）'),
        case_number: z
          .string()
          .optional()
          .describe('事件番号。例：「令和5年(ワ)第680号」「平成25(ネ)2334」。「令和5年(ワ)」「(行ケ)」のように一部だけでもよい。符号のひらがな・カタカナは区別される（民事の地裁第一審は「ワ」、刑事は「わ」）'),
        court_name: z
          .string()
          .optional()
          .describe('裁判所名（正式名称）。例：「東京地方裁判所」「知的財産高等裁判所」。category が supreme のときは使えない'),
        branch_name: z.string().optional().describe('支部名。例：「立川支部」'),
        case_name: z
          .string()
          .optional()
          .describe('事件名に含まれる語。例：「損害賠償」。category が supreme / high / administrative / labor のときだけ使える'),
        sort: z
          .enum(['date_desc', 'date_asc', 'court'])
          .optional()
          .describe('並び順。date_desc＝裁判年月日の新しい順（既定）、date_asc＝古い順、court＝裁判所の建制順'),
        offset: z.number().int().min(0).optional().describe(`何件目から返すか（0始まり）。続きを見るときは next_offset の値を指定する`),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await service.search({
          keywords: args.keywords,
          keywordsAnd: args.keywords_and,
          category: args.category as keyof typeof CATEGORIES | undefined,
          dateFrom: args.date_from,
          dateTo: args.date_to,
          caseNumber: args.case_number,
          courtName: args.court_name,
          branchName: args.branch_name,
          caseName: args.case_name,
          sort: args.sort,
          offset: args.offset,
        });
        // 件数が多いので、1件を1行にして返す（字数を抑えるため）
        const rows = result.items.map((item) =>
          JSON.stringify({
            id: item.id,
            case_number: item.caseNumber,
            case_name: item.caseName,
            date: item.date,
            date_iso: item.dateIso,
            court: item.court,
            ...(item.notes.length > 0 ? { notes: item.notes } : {}),
            categories: item.categories.map((c) => c.label),
          }),
        );
        const head = {
          total: result.total,
          offset: result.offset,
          returned: result.items.length,
          next_offset: result.nextOffset,
          search_url: result.url,
          detail_url: 'https://www.courts.go.jp/hanrei/{id}/detail{N}/index.html (N は区分で決まる。get_case が正確なURLを返す)',
          ...(result.total === 0
            ? { note: '該当なし。このサイトに全ての裁判例が載っているわけではありません。語や区分を変えて試してください。' }
            : {}),
        };
        const text = `${JSON.stringify(head, null, 1).replace(/\n}$/, '')},\n "results": [\n${rows.join(',\n')}\n ]\n}`;
        return { content: [{ type: 'text' as const, text }] };
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    'get_case',
    {
      title: '裁判例のメタデータを取得',
      description:
        'IDを指定して、詳細ページの項目（事件番号、事件名、裁判年月日、裁判所、結果、原審、判示事項、裁判要旨、参照法条など。区分によって項目は異なる）と全文PDFのURLを返す。IDは search_cases の結果、または詳細ページのURL（/hanrei/{ID}/detail{N}/）から分かる。',
      inputSchema: {
        id: z.number().int().positive().describe('裁判例のID（search_cases の結果の id）'),
        detail_type: z
          .number()
          .int()
          .optional()
          .describe(
            `詳細ページの種類（URLの detail{N} の N）。通常は省略する（検索結果から自動で決まる）。${Object.entries(DETAIL_TYPES)
              .map(([n, label]) => `${n}＝${label}`)
              .join('、')}`,
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const info = await service.getCase(args.id, args.detail_type);
        const fields: Record<string, string> = {};
        for (const f of info.fields) {
          let label = f.label;
          for (let n = 2; label in fields; n++) label = `${f.label}（${n}）`;
          fields[label] = f.value;
        }
        return json({
          id: info.id,
          case_number: info.caseNumber,
          case_name: info.caseName,
          date: info.date,
          date_iso: info.dateIso,
          court: info.court,
          fields,
          detail_pages: info.detailPages.map((p) => ({ detail_type: p.detailType, category: p.label, url: p.url })),
          pdf_url: info.pdfUrl,
          ...(info.attachments.length > 0 ? { attachments: info.attachments } : {}),
          ...(info.categoryConfirmed
            ? {}
            : {
                note: 'この裁判例の区分は裁判所名からの推定です。行政・労働・高裁判例集などの区分に固有の項目は、detail_type を指定すると取得できます。',
              }),
        });
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    'get_full_text',
    {
      title: '裁判例の本文を取得',
      description: `IDを指定して、全文PDFから取り出した本文を返す。先頭に全体のページ数・文字数と見出しの一覧（主文、理由、第1…）が付く。長い場合は max_chars でページの区切りで打ち切られるので、案内される page_from で続きを取得する。特定の部分だけ読みたいときは section（見出しの番号）か page_from / page_to を指定する。本文中の【N頁】は元PDFのページ番号（段落の始まりの位置）。`,
      inputSchema: {
        id: z.number().int().positive().describe('裁判例のID（search_cases の結果の id）'),
        section: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('見出しの番号（このツールの出力の「見出し」に出る [N]）。その見出しの部分だけを返す'),
        page_from: z.number().int().positive().optional().describe('このページから（1始まり。元PDFのページ番号）'),
        page_to: z.number().int().positive().optional().describe('このページまで'),
        max_chars: z
          .number()
          .int()
          .min(1000)
          .max(MAX_MAX_CHARS)
          .optional()
          .describe(`1回に返す本文の文字数の上限。既定 ${DEFAULT_MAX_CHARS}`),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const doc = await service.getFullText(args.id);
        if (doc.paragraphs.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `ID ${args.id}（全${doc.pageCount}頁）のPDFからは文字を取り出せませんでした。画像だけのPDFの可能性があります。`,
              },
            ],
          };
        }
        const r = renderText(doc, {
          section: args.section,
          pageFrom: args.page_from,
          pageTo: args.page_to,
          maxChars: args.max_chars ?? DEFAULT_MAX_CHARS,
        });

        const header: string[] = [];
        const range = r.pageFrom === r.pageTo ? `${r.pageFrom}頁` : `${r.pageFrom}〜${r.pageTo}頁`;
        header.push(
          `ID ${args.id}／全${doc.pageCount}頁・${doc.charCount.toLocaleString('ja-JP')}字。今回の範囲：${
            r.section ? `[${r.section.index}] ${r.section.title} の ` : ''
          }${range}（${r.chars.toLocaleString('ja-JP')}字）`,
        );
        if (r.truncated && r.nextPageFrom !== null) {
          const more = r.section
            ? `section=${r.section.index}, page_from=${r.nextPageFrom}`
            : `page_from=${r.nextPageFrom}${args.page_to !== undefined ? `, page_to=${r.rangeEnd}` : ''}`;
          header.push(`※ 上限（max_chars）に達したため途中までです。続きは ${more} で取得できます。`);
        }
        if (doc.emptyPages.length > 0) {
          header.push(`※ 文字を取り出せなかったページ（図表・画像の可能性）：${doc.emptyPages.join('、')}頁`);
        }
        header.push('見出し：', ...outline(doc));
        header.push('（本文はPDFから機械的に取り出して整形したもの。全角英数字は半角にしてある。正確な引用には原文PDFを確認すること）');

        return { content: [{ type: 'text' as const, text: `${header.join('\n')}\n----\n${r.text}` }] };
      } catch (e) {
        return failure(e);
      }
    },
  );
}

export function createServer(service: HanreiService): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: INSTRUCTIONS });
  registerTools(server, service);
  return server;
}
