import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

/**
 * 에이전트 실행 API
 * POST /api/agents
 * body: { category: string, params?: Record<string, string> }
 *
 * 각 카테고리에 맞는 스크립트를 실행하고 stdout/stderr를 반환합니다.
 */

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");

interface AgentConfig {
  command: string;
  args: string[];
  cwd: string;
  description: string;
  outputPath?: string;
}

function getAgentConfig(category: string, params: Record<string, string> = {}): AgentConfig | null {
  switch (category) {
    case "Macro 분석":
      return {
        command: "python",
        args: ["update_macro.py"],
        cwd: WORKSPACE_ROOT,
        description: "KOSIS 데이터 → Macro Analysis 엑셀 업데이트",
        outputPath: "Macro Analysis.xlsx",
      };

    case "장표 번역":
      return {
        command: "python",
        args: [
          "translate.py",
          ...(params.input ? ["--input", params.input] : []),
          ...(params.output ? ["--output", params.output] : []),
        ],
        cwd: path.join(WORKSPACE_ROOT, "ppt-translate"),
        description: "한글 PPT → 영문 PPT 번역",
        outputPath: params.output || "ppt-translate/output/translated.pptx",
      };

    case "예산·구매 품의":
      return {
        command: "node",
        args: [
          "fill.js",
          params.docType || "survey-b",
          ...(params.dryRun !== "false" ? ["--dry-run"] : []),
        ],
        cwd: WORKSPACE_ROOT,
        description: "전자결재 양식 자동 입력",
      };

    case "회의록 생성":
      return {
        command: "python",
        args: [
          "summarize.py",
          params.inputFile || "input/meeting.txt",
          ...(params.notion === "true" ? ["--notion"] : []),
        ],
        cwd: path.join(WORKSPACE_ROOT, "meeting-notes"),
        description: "TXT → Claude 요약 → Notion 등록",
        outputPath: "meeting-notes/output/summary.json",
      };

    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { category, params = {} } = body;

  const config = getAgentConfig(category, params);
  if (!config) {
    return NextResponse.json(
      { error: `지원하지 않는 카테고리: ${category}` },
      { status: 400 }
    );
  }

  try {
    const result = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>((resolve) => {
      const proc = spawn(config.command, config.args, {
        cwd: config.cwd,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });

      // 5분 타임아웃
      setTimeout(() => {
        proc.kill();
        resolve({ stdout, stderr: stderr + "\n[TIMEOUT] 5분 초과", exitCode: 1 });
      }, 300000);
    });

    return NextResponse.json({
      success: result.exitCode === 0,
      description: config.description,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      outputPath: config.outputPath,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `실행 실패: ${err}` },
      { status: 500 }
    );
  }
}

// GET: 지원 에이전트 목록 조회
export async function GET() {
  return NextResponse.json({
    agents: [
      { category: "Macro 분석", command: "python update_macro.py", ready: true },
      { category: "장표 번역", command: "python ppt-translate/translate.py", ready: true },
      { category: "예산·구매 품의", command: "node fill.js", ready: true },
      { category: "회의록 생성", command: "python meeting-notes/summarize.py", ready: true },
      { category: "장표 제작", command: "(미구현)", ready: false },
      { category: "Placement 분석", command: "(미구현)", ready: false },
    ],
  });
}
