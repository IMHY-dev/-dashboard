"use client";

import { useState } from "react";
import Link from "next/link";

interface Step {
  label: string;
  description: string;
  status: "locked" | "ready" | "running" | "done" | "error";
  output?: string;
  stage?: number; // run_placement_agent.py --stage
}

export default function PlacementAgent() {
  const [quarter, setQuarter] = useState("");
  const [quarterConfirmed, setQuarterConfirmed] = useState(false);
  const [steps, setSteps] = useState<Step[]>([
    { label: "Stage 1-JK: R_통합 생성", description: "run_jk.py — JobKorea Raw 데이터를 분류표에 매칭하여 R_통합 시트를 생성합니다.", status: "locked", stage: 1 },
    { label: "Stage 1-AM: R_통합 생성", description: "run_am.py — AlbaMain Raw 데이터를 분류표에 매칭하여 R_통합 시트를 생성합니다.", status: "locked", stage: 1 },
    { label: "Stage 2: RMS 계산", description: "calc_rms.py + calc_rms_am.py — JK/AM 각각 14개 시트 RMS를 계산합니다.", status: "locked", stage: 2 },
    { label: "Stage 3: PPT 자동 생성", description: "gen_ppt.py — 분기 PPT를 자동 생성합니다 (6슬라이드).", status: "locked", stage: 3 },
    { label: "수작업 확인", description: "산점도/부록 슬라이드는 수동 보완이 필요합니다.", status: "locked" },
  ]);
  const [running, setRunning] = useState(false);

  const confirmQuarter = () => {
    if (!quarter.match(/^\d{2}Q[1-4]$/i)) return;
    setQuarterConfirmed(true);
    setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "ready" } : s)));
  };

  const runStep = async (stepIdx: number) => {
    const step = steps[stepIdx];
    setRunning(true);
    setSteps((prev) => prev.map((s, i) => (i === stepIdx ? { ...s, status: "running", output: undefined } : s)));

    // 마지막 단계(수작업)는 확인만
    if (!step.stage) {
      await new Promise((r) => setTimeout(r, 500));
      setSteps((prev) => prev.map((s, i) => (i === stepIdx ? { ...s, status: "done", output: "수작업 확인 단계입니다. 산점도(슬라이드 7-10, 14-17)와 부록을 수동으로 보완해주세요." } : s)));
      setRunning(false);
      return;
    }

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicFile: "regular/placement-analysis",
          params: { quarter: quarter.toUpperCase(), stage: String(step.stage) },
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSteps((prev) => prev.map((s, i) => {
          if (i === stepIdx) return { ...s, status: "done", output: data.stdout || "완료" };
          if (i === stepIdx + 1 && s.status === "locked") return { ...s, status: "ready" };
          return s;
        }));
      } else {
        setSteps((prev) => prev.map((s, i) => (i === stepIdx ? { ...s, status: "error", output: data.stderr || data.error || "실패" } : s)));
      }
    } catch (err) {
      setSteps((prev) => prev.map((s, i) => (i === stepIdx ? { ...s, status: "error", output: `서버 연결 실패: ${err}` } : s)));
    }
    setRunning(false);
  };

  const allDone = steps.every((s) => s.status === "done");

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

      {/* 분기 입력 */}
      <div className={`p-5 rounded-xl mb-6 border ${quarterConfirmed ? "border-green-500/30 bg-green-500/5" : "border-gray-600"}`} style={quarterConfirmed ? {} : { background: "var(--surface)" }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-muted)" }}>분기 선택</h2>
        <div className="flex gap-3">
          <input
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            placeholder="예: 26Q1"
            disabled={quarterConfirmed}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-black border border-gray-700 text-white placeholder-gray-500 disabled:opacity-50"
          />
          {!quarterConfirmed ? (
            <button onClick={confirmQuarter} disabled={!quarter.match(/^\d{2}Q[1-4]$/i)}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-black hover:opacity-80" style={{ background: "var(--accent)" }}>
              확정
            </button>
          ) : (
            <span className="px-6 py-2.5 text-green-400 text-sm">✅ {quarter.toUpperCase()}</span>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          {["25Q4", "26Q1", "26Q2"].map((q) => (
            <button key={q} onClick={() => { setQuarter(q); }} disabled={quarterConfirmed}
              className="px-3 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-all disabled:opacity-30">
              {q}
            </button>
          ))}
        </div>
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

              {step.output && (
                <div className={`mt-3 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap ${
                  step.status === "error" ? "bg-red-500/10 text-red-300" : "bg-black/30 text-gray-300"
                }`}>
                  {step.output}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {allDone && (
        <div className="mt-6 p-5 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
          <div className="text-green-400 font-medium mb-1">✅ Placement {quarter.toUpperCase()} 분석 전체 완료</div>
          <p className="text-xs text-gray-400">PPT 파일을 확인하고 산점도/부록을 수동 보완해주세요.</p>
        </div>
      )}
    </div>
  );
}
