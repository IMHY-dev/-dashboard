import { NextRequest, NextResponse } from "next/server";

/**
 * 슬랙 웹훅 수신 엔드포인트
 *
 * 슬랙 Event Subscriptions에서 이 URL을 등록하면:
 * 1. 지정된 채널에 메시지가 올 때 슬랙이 여기로 POST를 보냄
 * 2. 메시지를 파싱해서 업무 대기목록에 추가
 *
 * 슬랙 앱 설정 방법:
 * 1. https://api.slack.com/apps 에서 앱 생성 (또는 기존 앱 사용)
 * 2. Event Subscriptions 활성화
 * 3. Request URL: https://<vercel-domain>/api/slack-webhook
 * 4. Subscribe to bot events: message.channels, message.groups
 * 5. OAuth & Permissions에서 채널 읽기 권한 추가
 *
 * 모니터링할 채널:
 * - #section-전략추진실-all (C08NNP1D3A9)
 * - #section-전략추진실-창준님 (C0AJ265GP8W)
 * - #wg-전략추진실 (C09L1LBK1GD)
 */

// 인메모리 태스크 저장 (추후 DB로 교체)
const pendingTasks: Array<{
  id: string;
  from: string;
  to: string;
  message: string;
  channel: string;
  timestamp: string;
  slackTs: string;
}> = [];

// 슬랙 유저 ID → 이름 매핑
const USER_MAP: Record<string, string> = {
  U08JWR295EC: "이창준",
  U0A26MKAP7E: "주호연",
  U0A7J7J437A: "임성욱",
  U0ALAGP8E79: "임한솔",
  U09A4D5KFUH: "나여준",
  U097N6HRYER: "김범석",
  U09LXJNF99N: "방지수",
  U09L3B29490: "박관우",
};

// 채널 ID → 이름 매핑
const CHANNEL_MAP: Record<string, string> = {
  C08NNP1D3A9: "#section-전략추진실-all",
  C0AJ265GP8W: "#section-전략추진실-창준님",
  C09L1LBK1GD: "#wg-전략추진실",
  C0AL18T5KU6: "#wg-사업성장팀x전략추진실",
};

// 멘션에서 담당자 추출 (예: <@U0A26MKAP7E> → 주호연)
function extractMentionedUser(text: string): string {
  const mentionRegex = /<@(U[A-Z0-9]+)>/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const name = USER_MAP[match[1]];
    if (name) mentions.push(name);
  }
  return mentions.length > 0 ? mentions[0] : "미지정";
}

// 메시지 텍스트 정리 (슬랙 마크업 제거)
function cleanSlackText(text: string): string {
  return text
    .replace(/<@U[A-Z0-9]+>/g, "") // 멘션 제거
    .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, "#$1") // 채널 링크 → #채널명
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2") // URL 링크 → 텍스트
    .replace(/<(https?:\/\/[^>]+)>/g, "$1") // 순수 URL
    .trim();
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // 1. 슬랙 URL 검증 (최초 등록 시)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // 2. 이벤트 처리
  if (body.type === "event_callback") {
    const event = body.event;

    // 봇 메시지 무시
    if (event.bot_id || event.subtype === "bot_message") {
      return NextResponse.json({ ok: true });
    }

    // 메시지 이벤트만 처리
    if (event.type === "message" && !event.subtype) {
      const fromUser = USER_MAP[event.user] || event.user;
      const toUser = extractMentionedUser(event.text || "");
      const message = cleanSlackText(event.text || "");
      const channel = CHANNEL_MAP[event.channel] || event.channel;

      // 빈 메시지 무시
      if (!message) {
        return NextResponse.json({ ok: true });
      }

      const task = {
        id: `slack-${event.ts}`,
        from: fromUser,
        to: toUser,
        message,
        channel,
        timestamp: new Date(parseFloat(event.ts) * 1000).toLocaleString("ko-KR"),
        slackTs: event.ts,
      };

      pendingTasks.push(task);

      // 최대 100개 유지
      if (pendingTasks.length > 100) {
        pendingTasks.shift();
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

// GET: 대시보드에서 pending tasks 가져가기
export async function GET() {
  const tasks = [...pendingTasks];
  pendingTasks.length = 0; // 읽고 나면 비우기
  return NextResponse.json({ tasks });
}
