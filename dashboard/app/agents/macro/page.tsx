"use client";

import { useState } from "react";
import Link from "next/link";

interface Step {
  label: string;
  description: string;
  status: "locked" | "ready" | "running" | "done" | "error";
  output?: string;
}

export default function MacroAgent() {
  const [steps, setSteps] = useState<Step[]>([
    { label: "KOSIS 파일 탐색", description: "SharePoint 폴더에서 최신 KOSIS 파일(산업_규모별_고용_*.xlsx)을 자동 탐색합니다.", status: "ready" },
    { label: "데이터 읽기", description: "KOSIS 파일에서 새로 추가할 월과 지표 컬럼을 읽습니다.", status: "locked" },
    { label: "Macro 엑셀 열기", description: "Macro Analysis 엑셀 워크북을 열어 기존 데이터를 확인합니다.", status: "locked" },
    { label: "10개 시트 업데이트", description: "빈일자리·채용·근로자·입직자 (상용/임시일용) 10개 시트에 데이터를 매칭하여 입력합니다.", status: "locked" },
    { label: "저장 완료", description: "변경된 엑셀 파일을 저장합니다.", status: "locked" },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [running, setRunning] = useState(false);

  const runStep = async (stepIdx: number) => {
    setRunning(true);
    // 현재 단계 running 표시
    setSteps((prev) => prev.map((s, i) => (i === stepIdx ? { ...s, status: "running" } : s)));

    // 첫 단계에서 전체 스크립트 실행 (결과를 단계별로 나눠 표시)
    if (stepIdx === 0) {
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicFile: "regular/macro-update" }),
        });
        const data = await res.json();

        if (data.success) {
          const stdout = data.stdout || "";
          const lines = stdout.split("\n").filter((l: string) => l.trim());

          // 첫 단계 완료 + 출력
          setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "done", output: lines.slice(0, 3).join("\n") || "KOSIS 파일 탐색 완료" } : s)));
          setCurrentStep(1);

          // 나머지 단계를 순차적으로 표시 (실제 결과를 나눠서)
          const stepOutputs = [
            lines.slice(3, 6).join("\n") || "데이터 읽기 완료",
            lines.slice(6, 9).join("\n") || "Macro 엑셀 열기 완료",
            lines.slice(9, 15).join("\n") || "10개 시트 업데이트 완료",
            lines.slice(15).join("\n") || "저장 완료",
          ];

          for (let i = 1; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 800));
            setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: "ready" } : s)));
            setCurrentStep(i);
          }

          // 모든 단계를 ready로 전환했으니, 사용자가 각각 클릭 가능
          // 하지만 이미 실행은 끝난 상태이므로 출력만 보여주면 됨
          setSteps((prev) =>
            prev.map((s, i) => {
              if (i === 0) return s; // 이미 done
              return { ...s, status: "ready", output: stepOutputs[i - 1] };
            })
          );
          setCurrentStep(1);
        } else {
          setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "error", output: data.stderr || data.error || "실행 실패" } : s)));
        }
      } catch (err) {
        setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "error", output: `서버 연결 실패: ${err}` } : s)));
      }
    } else {
      // 이미 실행 완료된 단계: 결과만 표시
      await new Promise((r) => setTimeout(r, 300));
      setSteps((prev) => prev.map((s, i) => (i === stepIdx ? { ...s, status: "done" } : s)));
      setCurrentStep(stepIdx + 1);

      // 다음 단계 unlock
      if (stepIdx + 1 < steps.length) {
        setSteps((prev) => prev.map((s, i) => (i === stepIdx + 1 && s.status === "locked" ? { ...s, status: "ready" } : s)));
      }
    }
    setRunning(false);
  };

  const allDone = steps.every((s) => s.status === "done");

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
                  <button
                    onClick={() => runStep(i)}
                    disabled={running}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${running ? "bg-gray-700 text-gray-500" : "text-black hover:opacity-80"}`}
                    style={running ? {} : { background: "var(--accent)" }}
                  >
                    {running ? "⏳" : "▶ 실행"}
                  </button>
                )}
                {step.status === "running" && (
                  <span className="text-xs text-yellow-400 animate-pulse">실행 중...</span>
                )}
              </div>

              {/* 단계별 출력 */}
              {step.output && step.status !== "locked" && (
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
          <div className="text-green-400 font-medium mb-1">✅ Macro 업데이트 전체 완료</div>
          <p className="text-xs text-gray-400">SharePoint의 Macro Analysis 엑셀을 확인하세요.</p>
        </div>
      )}
    </div>
  );
}
