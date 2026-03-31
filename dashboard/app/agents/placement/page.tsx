"use client";

import { useState } from "react";
import Link from "next/link";

interface StepInfo {
  label: string;
  status: "pending" | "running" | "done" | "error";
}

const STEPS = [
  "Stage 1-JK: run_jk.py → R_통합 시트 생성",
  "Stage 1-AM: run_am.py → R_통합 시트 생성",
  "Stage 2-JK: calc_rms.py → RMS 계산",
  "Stage 2-AM: calc_rms_am.py → RMS 계산",
  "Stage 3: gen_ppt.py → PPT 자동 생성",
];

export default function PlacementAgent() {
  const [quarter, setQuarter] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>(STEPS.map((s) => ({ label: s, status: "pending" })));
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleRun = async () => {
    if (!quarter.match(/^\d{2}Q[1-4]$/i)) {
      setError("분기 형식이 올바르지 않습니다. 예: 26Q1, 25Q4");
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
    }, 8000);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicFile: "regular/placement-analysis", params: { quarter: quarter.toUpperCase() } }),
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
          <h1 className="text-2xl font-bold">📈 Placement Survey 분석</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">● 활성</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          JK/AM Raw 데이터 → R_통합 분류 → RMS 계산 → PPT 자동 생성
        </p>
      </div>

      {/* 입력 */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-muted)" }}>분기 선택</h2>
        <div className="flex gap-3">
          <input
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            placeholder="예: 26Q1"
            className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-black border border-gray-700 text-white placeholder-gray-500"
          />
          <button
            onClick={handleRun}
            disabled={running || !quarter}
            className={`px-8 py-2.5 rounded-lg text-sm font-medium transition-all ${running ? "bg-gray-700 text-gray-400 cursor-wait" : !quarter ? "bg-gray-800 text-gray-500" : "text-black hover:opacity-80"}`}
            style={running || !quarter ? {} : { background: "var(--accent)" }}
          >
            {running ? "⏳ 실행 중..." : "▶ 분석 시작"}
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {["25Q4", "26Q1", "26Q2"].map((q) => (
            <button key={q} onClick={() => setQuarter(q)}
              className="px-3 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-all">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 파이프라인 */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-muted)" }}>파이프라인 진행</h2>
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
          <h2 className="text-sm font-medium mb-2 text-green-400">✅ 분석 완료</h2>
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
