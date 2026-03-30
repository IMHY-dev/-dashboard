import { NextRequest, NextResponse } from "next/server";

/**
 * /api/context
 *
 * topicFile 기반으로 Notion Meeting Notes DB에서 관련 싱크를 검색해 반환.
 *
 * 필요한 환경변수:
 *   NOTION_TOKEN — Notion Integration Token (secret_xxx)
 *   Vercel > Settings > Environment Variables에 추가
 *
 * GET ?topicFile=regular/macro-update
 * Response: { results: [{ id, title, date, decisions, url }] }
 */

const MEETING_NOTES_DB_ID = "32e7d8322b0480fbaa8dc84357e3ec10";

const TOPIC_KEYWORDS: Record<string, string[]> = {
  "regular/macro-update":       ["매크로", "KOSIS"],
  "regular/macro-indicators":   ["매크로", "지표"],
  "regular/placement-update":   ["플레이스먼트", "서베이", "설문"],
  "regular/placement-analysis": ["플레이스먼트", "RMS"],
  "fluid/ppt-work":             ["장표", "PPT", "번역"],
  "fluid/academia-contract":    ["산학협력", "기프티콘", "계약"],
  "budget/placement-concur":    ["플레이스먼트", "컨커"],
  "budget/enkoline-concur":     ["엔코라인", "통역"],
  "budget/consulting-concur":   ["컨설팅", "BCG"],
  "budget/law-firm":            ["법무법인"],
  "budget/ninehire":            ["나인하이어", "에스크로", "스톡옵션"],
  "budget/gifticon":            ["기프티콘"],
  "budget/budget-transfer":     ["예산", "품의", "이월"],
  "budget/vendor-registration": ["공급사", "벤더"],
};

type NotionPage = {
  id: string;
  url: string;
  properties: {
    제목?: { title?: { plain_text: string }[] };
    결정사항?: { rich_text?: { plain_text: string }[] };
    일시?: { date?: { start: string } };
  };
};

export async function GET(request: NextRequest) {
  const topicFile = new URL(request.url).searchParams.get("topicFile") ?? "";
  const notionToken = process.env.NOTION_TOKEN;

  if (!notionToken) return NextResponse.json({ results: [] });

  const keywords = TOPIC_KEYWORDS[topicFile] ?? [];
  if (keywords.length === 0) return NextResponse.json({ results: [] });

  // 키워드별 OR 필터 (제목 + 결정사항 모두 검색)
  const filterConditions = keywords.flatMap((kw) => [
    { property: "제목", title: { contains: kw } },
    { property: "결정사항", rich_text: { contains: kw } },
  ]);

  const res = await fetch(
    `https://api.notion.com/v1/databases/${MEETING_NOTES_DB_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: { or: filterConditions },
        sorts: [{ property: "일시", direction: "descending" }],
        page_size: 5,
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) return NextResponse.json({ results: [] });

  const data = await res.json();
  const results = (data.results ?? []).map((page: NotionPage) => ({
    id: page.id,
    title: page.properties?.제목?.title?.[0]?.plain_text ?? "",
    date: page.properties?.일시?.date?.start ?? "",
    decisions: page.properties?.결정사항?.rich_text?.map((r) => r.plain_text).join("") ?? "",
    url: page.url,
  }));

  return NextResponse.json({ results });
}
