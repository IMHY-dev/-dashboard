"use client";

import { useState } from "react";
import Link from "next/link";

interface Step {
  label: string;
  description: string;
  status: "locked" | "ready" | "running" | "done" | "error";
  output?: string;
}

const EXAMPLES = [
  "ATS 기프티콘 예산품의 네이버페이 20개 스타벅스 10개",
  "6월 산학협력 프리랜서 예산품의",
  "Placement Survey 3월 500만원 예산품의",
];

export default function BudgetAgent() {
  const [message, setMessage] = useState("");
  const [messageConfirmed, setMessageConfirmed] = useState(false);
  const [steps, setSteps] = useState<Step[]>([
    { label: "자연어 파싱 (Claude API)", description: "입력된 텍스트를 Claude가 분석하여 문서유형, 수량, 금액 등 파라미터를 추출합니다.", status: "locked" },
    { label: "문서유형 판단", description: "파싱 결과에서 문서유형(ats-b, survey-p 등)과 옵션을 확정합니다.", status: "locked" },
    { label: "템플릿 로드", description: "해당 문서유형의 템플릿(제목, 본문, 비용센터, GL계정)을 로드합니다.", status: "locked" },
    { label: "브라우저 열기 + 폼 입력 (dry-run)", description: "Playwright로 Worxphere를 열고 폼에 자동 입력합니다. 제출하지 않고 대기합니다.", status: "locked" },
    { label: "사용자 검수", description: "브라우저에서 입력 내용을 직접 확인하고, 문제 없으면 수동 제출합니다.", status: "locked" },
  ]);
  const [running, setRunning] = useState(false);

  const confirmMessage = () => {
    if (!message.trim()) return;
    setMessageConfirmed(true);
    setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "ready" } : s)));
  };

  const runStep = async (stepIdx: number) => {
    setRunning(true);
    setSteps((prev) => prev.map((s, i) => (i === stepIdx ? { ...s, status: "running", output: undefined } : s)));

    // Step 0에서 auto.js 실행 (NL 파싱 + fill.js dry-run 전체)
    if (stepIdx === 0) {
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicFile: "fluid/budget-draft", params: { message } }),
        });
        const data = await res.json();

        if (data.success) {
          const stdout = data.stdout || "";
          const lines = stdout.split("\n").filter((l: string) => l.trim());

          // 파싱 결과 추출
          const parseResult = lines.find((l: string) => l.includes("{")) || "파싱 완료";
          const cmdLine = lines.find((l: string) => l.includes("실행:")) || "";

          setSteps((prev) => prev.map((s, i) => {
            if (i === 0) return { ...s, status: "done", output: parseResult };
            if (i === 1) return { ...s, status: "ready", output: cmdLine || "문서유형 판단 완료" };
            return s;
          }));
        } else {
          setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "error", output: data.stderr || data.error || "파싱 실패" } : s)));
        }
      } catch (err) {
        setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "error", output: `서버 연결 실패: ${err}` } : s)));
      }
    } else if (stepIdx === 4) {
      // 마지막 단계: 확인만
      await new Promise((r) => setTimeout(r, 300));
      setSteps((prev) => prev.map((s, i) => (i === 4 ? { ...s, status: "done", output: "브라우저에서 직접 확인 후 제출하세요." } : s)));
    } else {
      // 중간 단계: 순차 진행
      await new Promise((r) => setTimeout(r, 500));
      setSteps((prev) => prev.map((s, i) => {
        if (i === stepIdx) return { ...s, status: "done" };
        if (i === stepIdx + 1 && s.status === "locked") return { ...s, status: "ready" };
        return s;
      }));
    }
    setRunning(false);
  };

  const allDone = steps.every((s) => s.status === "done");

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <Link href="/" className="text-sm text-gray-400 hover:text-white transition-all">← 대시보드</Link>

      <div className="mt-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">📋 예산·구매 품의</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">● 활성</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          자연어 → NL 파싱 → Worxphere 전자결재 자동 입력 (dry-run)
        </p>
      </div>

      {/* 요청 입력 */}
      <div className={`p-5 rounded-xl mb-6 border ${messageConfirmed ? "border-green-500/30 bg-green-500/5" : "border-gray-600"}`} style={messageConfirmed ? {} : { background: "var(--surface)" }}>
        <h2 className="text-sm font-medium mb-2" style={{ color: "var(--text-muted)" }}>요청 내용</h2>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="품의할 내용을 자연어로 입력하세요..." rows={3} disabled={messageConfirmed}
          className="w-full px-4 py-3 rounded-lg text-sm bg-black border border-gray-700 text-white placeholder-gray-500 resize-none disabled:opacity-50" />
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setMessage(ex)} disabled={messageConfirmed}
              className="px-3 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-all disabled:opacity-30 truncate max-w-xs">
              {ex}
            </button>
          ))}
        </div>
        {!messageConfirmed && (
          <button onClick={confirmMessage} disabled={!message.trim()}
            className="mt-3 w-full px-6 py-2.5 rounded-lg text-sm font-medium text-black hover:opacity-80" style={{ background: "var(--accent)" }}>
            확정
          </button>
        )}
      </div>

      {/* 단계별 진행 */}
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className={`rounded-xl border transition-all ${
            step.status === "done" ? "border-green-500/30 bg-green-500/5" :
            step.status === "running" ? "border-yellow-500/30 bg-yellow-500/5" :
            step.status === "error" ? "border-red-500/30 bg-red-500/5" :
            step.status === "ready" ? "border-gray-600 bg-gray-800/30" :
            "border-gray-800 bg-gray-900/30 opacity-50"
          }`}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step.status === "done" ? "bg-green-500 text-black" :
                    step.status === "running" ? "bg-yellow-500 text-black animate-pulse" :
                    step.status === "error" ? "bg-red-500 text-white" :
                    step.status === "ready" ? "bg-gray-600 text-white" :
                    "bg-gray-800 text-gray-600"
                  }`}>
                    {step.status === "done" ? "✓" : step.status === "error" ? "✗" : i + 1}
                  </div>
                  <div>
                    <div className={`font-medium text-sm ${
                      step.status === "done" ? "text-green-400" :
                      step.status === "running" ? "text-yellow-400" :
                      step.status === "error" ? "text-red-400" :
                      step.status === "ready" ? "text-white" :
                      "text-gray-600"
                    }`}>{step.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{step.description}</div>
                  </div>
                </div>
                {step.status === "ready" && (
                  <button onClick={() => runStep(i)} disabled={running}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${running ? "bg-gray-700 text-gray-500" : "text-black hover:opacity-80"}`}
                    style={running ? {} : { background: "var(--accent)" }}>
                    {running ? "⏳" : "▶ 실행"}
                  </button>
                )}
                {step.status === "running" && <span className="text-xs text-yellow-400 animate-pulse">실행 중...</span>}
              </div>
              {step.output && step.status !== "locked" && (
                <div className={`mt-3 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap ${
                  step.status === "error" ? "bg-red-500/10 text-red-300" : "bg-black/30 text-gray-300"
                }`}>{step.output}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {allDone && (
        <div className="mt-6 p-5 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
          <div className="text-green-400 font-medium mb-1">✅ 품의 프로세스 완료</div>
          <p className="text-xs text-yellow-400">⚠ 실제 제출은 브라우저에서 직접 확인 후 진행하세요.</p>
        </div>
      )}
    </div>
  );
}
