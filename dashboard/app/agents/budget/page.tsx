"use client";

import { useState } from "react";
import Link from "next/link";

interface StepInfo {
  label: string;
  status: "pending" | "running" | "done" | "error";
}

const STEPS = [
  "자연어 파싱 (Claude API)",
  "문서유형 판단",
  "템플릿 로드",
  "브라우저 열기 (Playwright)",
  "폼 자동 입력 (dry-run)",
];

const EXAMPLES = [
  "ATS 기프티콘 예산품의 네이버페이 20개 스타벅스 10개",
  "6월 산학협력 프리랜서 예산품의",
  "Placement Survey 3월 500만원 예산품의",
  "ATS 기프티콘 구매품의 네이버페이 15개",
];

export default function BudgetAgent() {
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>(STEPS.map((s) => ({ label: s, status: "pending" })));
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleRun = async () => {
    if (!message.trim()) {
      setError("요청 내용을 입력해주세요.");
      return;
    }
    setRunning(true);
    setDone(false);
    setError("");
    setLog("");
    setSteps(STEPS.map((s) => ({ label: s, status: "pending" })));

    let stepIdx = 0;
    const interval = setInterval(() => {
      setSteps((prev) =>
        prev.map((s, i) => ({
          ...s,
          status: i < stepIdx ? "done" : i === stepIdx ? "running" : "pending",
        }))
      );
      stepIdx++;
      if (stepIdx > STEPS.length) clearInterval(interval);
    }, 4000);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicFile: "fluid/budget-draft", params: { message } }),
      });
      const data = await res.json();
      clearInterval(interval);

      if (data.success) {
        setSteps(STEPS.map((s) => ({ label: s, status: "done" })));
        setLog(data.stdout || "품의 자동 입력 완료 (dry-run)");
        setDone(true);
      } else {
        setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s)));
        setError(data.stderr || data.error || "실행 실패");
      }
    } catch (err) {
      clearInterval(interval);
      setError(`서버 연결 실패: ${err}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <Link href="/" className="text-sm text-gray-400 hover:text-white transition-all">← 대시보드</Link>

      <div className="mt-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">📋 예산·구매 품의</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">● 활성</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          자연어 → NL 파싱 → Worxphere 전자결재 자동 입력 (Playwright)
        </p>
      </div>

      {/* 입력 */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-muted)" }}>요청 내용</h2>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="품의할 내용을 자연어로 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-lg text-sm bg-black border border-gray-700 text-white placeholder-gray-500 resize-none"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setMessage(ex)}
              className="px-3 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-all truncate max-w-xs">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* 실행 */}
      <button
        onClick={handleRun}
        disabled={running || !message}
        className={`w-full px-6 py-3 rounded-xl text-base font-medium transition-all mb-6 ${running ? "bg-gray-700 text-gray-400 cursor-wait" : !message ? "bg-gray-800 text-gray-500" : "text-black hover:opacity-80"}`}
        style={running || !message ? {} : { background: "var(--accent)" }}
      >
        {running ? "⏳ 처리 중..." : done ? "🔄 다른 품의 실행" : "▶ 품의 실행 (dry-run)"}
      </button>

      {/* 지원 문서 유형 */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-muted)" }}>지원 문서 유형</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { code: "ats-b/p", name: "ATS 기프티콘" },
            { code: "survey-b/p", name: "Placement Survey" },
            { code: "free-b/p", name: "산학협력 프리랜서" },
            { code: "interview-b", name: "산학협력 인터뷰" },
          ].map((doc) => (
            <div key={doc.code} className="p-2 rounded bg-gray-800/50 flex justify-between">
              <span className="text-gray-300">{doc.name}</span>
              <code className="text-gray-500">{doc.code}</code>
            </div>
          ))}
        </div>
      </div>

      {/* 진행 단계 */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-muted)" }}>진행 단계</h2>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step.status === "done" ? "bg-green-500 text-black" :
                step.status === "running" ? "bg-yellow-500 text-black animate-pulse" :
                step.status === "error" ? "bg-red-500 text-white" :
                "bg-gray-700 text-gray-400"
              }`}>
                {step.status === "done" ? "✓" : step.status === "error" ? "✗" : i + 1}
              </div>
              <span className={`text-sm ${
                step.status === "done" ? "text-green-400" :
                step.status === "running" ? "text-yellow-400" :
                step.status === "error" ? "text-red-400" :
                "text-gray-500"
              }`}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {log && (
        <div className="p-5 rounded-xl mb-6 bg-green-500/10 border border-green-500/30">
          <h2 className="text-sm font-medium mb-2 text-green-400">✅ dry-run 완료</h2>
          <p className="text-xs text-yellow-400 mb-2">⚠ 실제 제출은 브라우저에서 직접 확인 후 진행하세요.</p>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">{log}</pre>
        </div>
      )}
      {error && (
        <div className="p-5 rounded-xl mb-6 bg-red-500/10 border border-red-500/30">
          <h2 className="text-sm font-medium mb-2 text-red-400">❌ 오류</h2>
          <pre className="text-xs text-red-300 whitespace-pre-wrap max-h-64 overflow-y-auto">{error}</pre>
        </div>
      )}
    </div>
  );
}
