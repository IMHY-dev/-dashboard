/**
 * Slack API 유틸리티
 *
 * 환경변수:
 *   SLACK_BOT_TOKEN — Bot User OAuth Token (xoxb-...)
 *
 * 필요한 Slack 앱 권한:
 *   chat:write    — 메시지 전송
 *   files:read    — 파일 URL 접근 (파일 다운로드)
 */

import fs from "fs";
import path from "path";

const SLACK_API = "https://slack.com/api";

function getToken(): string {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN 환경변수가 설정되지 않았습니다.");
  return token;
}

/**
 * Slack 채널/스레드에 텍스트 메시지 전송
 */
export async function postMessage(channel: string, text: string, threadTs?: string): Promise<boolean> {
  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("[Slack] postMessage 실패:", data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Slack] postMessage 에러:", err);
    return false;
  }
}

/**
 * Slack 파일을 로컬 폴더에 다운로드
 * Slack Event에서 event.files[].url_private 사용
 *
 * @returns 저장된 로컬 파일 경로 (실패 시 null)
 */
export async function downloadFile(
  fileUrl: string,
  fileName: string,
  destDir: string
): Promise<string | null> {
  try {
    // 디렉토리 생성
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const res = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!res.ok) {
      console.error("[Slack] 파일 다운로드 실패:", res.status);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const filePath = path.join(destDir, fileName);
    fs.writeFileSync(filePath, buffer);
    console.log(`[Slack] 파일 저장 완료: ${filePath}`);
    return filePath;
  } catch (err) {
    console.error("[Slack] downloadFile 에러:", err);
    return null;
  }
}

/**
 * Slack 파일 정보에서 PPTX 파일 추출
 */
export function extractPptxFiles(
  files: { name: string; url_private: string; mimetype: string; filetype: string }[]
): { name: string; url: string }[] {
  return files
    .filter(
      (f) =>
        f.filetype === "pptx" ||
        f.name.endsWith(".pptx") ||
        f.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
    .map((f) => ({ name: f.name, url: f.url_private }));
}

/**
 * Slack 파일 정보에서 텍스트 파일 추출 (TXT, MD)
 */
export function extractTextFiles(
  files: { name: string; url_private: string; filetype: string }[]
): { name: string; url: string }[] {
  return files
    .filter((f) => ["text", "markdown", "txt", "md"].includes(f.filetype) || f.name.match(/\.(txt|md)$/))
    .map((f) => ({ name: f.name, url: f.url_private }));
}
