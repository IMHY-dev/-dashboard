"use client";

import { useState } from "react";
import Link from "next/link";

interface StepInfo {
  label: string;
  status: "pending" | "running" | "done" | "error";
}

const STEPS: string[] = [
  "KOSIS 파일 탐색",
  "데이터 읽기",
  "Macro 엑셀 열기",
  "10개 시트 업데이트",
  "저장 완료",
];

export default function MacroAgent() {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>(STEPS.map((s) => ({ label: s, status: "pending" })));
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    setDone(false);
    setError("");
    setLog("");
    setSteps(STEPS.map((s) => ({ label: s, status: "pending" })));

    // 스텝 애니메이션
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
    }, 2000);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicFile: "regular/macro-update" }),
      });
      const data = await res.json();
      clearInterval(interval);

      if (data.success) {
        setSteps(STEPS.map((s) => ({ label: s, status: "done" })));
        setLog(data.stdout || "실행 완료");
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
          <h1 className="text-2xl font-bold">📊 Macro 분석</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">● 활성</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          KOSIS 데이터를 Macro Analysis 엑셀 10개 시트에 자동 반영합니다.
        </p>
      </div>

      {/* 실행 정보 */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-muted)" }}>실행 정보</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">커맨드:</span> <code className="text-gray-300">python update_macro.py</code></div>
          <div><span className="text-gray-500">데이터 소스:</span> KOSIS (국가통계포털)</div>
          <div><span className="text-gray-500">업데이트 대상:</span> 빈일자리·채용·근로자·입직자 (상용/임시일용)</div>
          <div><span className="text-gray-500">파라미터:</span> 없음 (자동 감지)</div>
        </div>
      </div>

      {/* 실행 버튼 */}
      <button
        onClick={handleRun}
        disabled={running}
        className={`w-full px-6 py-3 rounded-xl text-base font-medium transition-all mb-6 ${running ? "bg-gray-700 text-gray-400 cursor-wait" : "text-black hover:opacity-80"}`}
        style={running ? {} : { background: "var(--accent)" }}
      >
        {running ? "⏳ 실행 중..." : done ? "🔄 다시 실행" : "▶ Macro 업데이트 실행"}
      </button>

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
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 결과 */}
      {log && (
        <div className="p-5 rounded-xl mb-6 bg-green-500/10 border border-green-500/30">
          <h2 className="text-sm font-medium mb-2 text-green-400">✅ 실행 결과</h2>
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
