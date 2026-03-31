"use client";

import { useState } from "react";
import Link from "next/link";

interface Step {
  label: string;
  description: string;
  status: "locked" | "ready" | "running" | "done" | "error";
  output?: string;
}

export default function TranslateAgent() {
  const [inputFile, setInputFile] = useState("");
  const [fileConfirmed, setFileConfirmed] = useState(false);
  const [steps, setSteps] = useState<Step[]>([
    { label: "PPT 파일 로드", description: "ppt-translater/input/ 폴더에서 PPTX 파일을 읽고 슬라이드 수를 확인합니다.", status: "locked" },
    { label: "텍스트박스 크기 분석", description: "각 텍스트박스의 크기와 폰트 사이즈를 측정하여 글자수 제약을 계산합니다.", status: "locked" },
    { label: "용어집 로드", description: "terminology.json에서 18개 한→영 용어와 22개 보존어를 로드합니다.", status: "locked" },
    { label: "Claude API 번역", description: "슬라이드별 병렬 번역을 실행합니다 (Australian English, HR/Recruitment 도메인).", status: "locked" },
    { label: "후처리 적용", description: "7개 규칙 적용: 억/조 단위, 통화 순서, 호주 영어 철자, 중복 제거 등.", status: "locked" },
    { label: "번역 PPT 저장", description: "번역 결과를 PPTX + 번역 리포트(CSV/JSON)로 저장합니다.", status: "locked" },
  ]);
  const [running, setRunning] = useState(false);

  const confirmFile = () => {
    if (!inputFile.trim()) return;
    setFileConfirmed(true);
    setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "ready" } : s)));
  };

  const runStep = async (stepIdx: number) => {
    setRunning(true);
    setSteps((prev) => prev.map((s, i) => (i === stepIdx ? { ...s, status: "running", output: undefined } : s)));

    // Step 0에서 전체 번역 실행, 결과를 단계별로 나눠 표시
    if (stepIdx === 0) {
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicFile: "fluid/ppt-translate", params: { input: inputFile } }),
        });
        const data = await res.json();

        if (data.success) {
          const stdout = data.stdout || "번역 완료";
          // 첫 단계 완료
          setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "done", output: `PPT 파일 로드 성공` } : s)));

          // 나머지 단계를 순차적으로 ready로 전환
          for (let i = 1; i < 6; i++) {
            await new Promise((r) => setTimeout(r, 600));
            const outputs = [
              "텍스트박스 크기 분석 완료",
              "용어집 18개 항목 + 보존어 22개 로드",
              stdout.includes("slide") ? stdout : "Claude API 번역 완료",
              "후처리 7개 규칙 적용 완료",
              `번역 PPT 저장: ppt-translater/output/${inputFile.replace(/.*\//, "").replace(".pptx", "_en.pptx")}`,
            ];
            setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: "ready", output: outputs[i - 1] } : s)));
          }
          setRunning(false);
          return;
        } else {
          setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "error", output: data.stderr || data.error || "실패" } : s)));
        }
      } catch (err) {
        setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: "error", output: `서버 연결 실패: ${err}` } : s)));
      }
    } else {
      // 이미 실행 완료된 단계: done으로 전환 + 다음 단계 unlock
      await new Promise((r) => setTimeout(r, 300));
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
          <h1 className="text-2xl font-bold">🌐 장표 번역</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">● 활성</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          한글 PPT → 영문 PPT (Australian English, 용어집 + 후처리 7개 규칙)
        </p>
      </div>

      {/* 파일 입력 */}
      <div className={`p-5 rounded-xl mb-6 border ${fileConfirmed ? "border-green-500/30 bg-green-500/5" : "border-gray-600"}`} style={fileConfirmed ? {} : { background: "var(--surface)" }}>
        <h2 className="text-sm font-medium mb-2" style={{ color: "var(--text-muted)" }}>번역할 파일</h2>
        <p className="text-xs text-gray-500 mb-3">ppt-translater/input/ 폴더에 PPTX를 넣고 파일명을 입력하세요.</p>
        <div className="flex gap-3">
          <input value={inputFile} onChange={(e) => setInputFile(e.target.value)}
            placeholder="예: input/사업계획.pptx" disabled={fileConfirmed}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-black border border-gray-700 text-white placeholder-gray-500 disabled:opacity-50" />
          {!fileConfirmed ? (
            <button onClick={confirmFile} disabled={!inputFile.trim()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-black hover:opacity-80" style={{ background: "var(--accent)" }}>
              확정
            </button>
          ) : (
            <span className="px-6 py-2.5 text-green-400 text-sm">✅</span>
          )}
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
          <div className="text-green-400 font-medium mb-1">✅ 번역 완료</div>
          <p className="text-xs text-gray-400">ppt-translater/output/ 폴더에서 번역 결과를 확인하세요.</p>
        </div>
      )}
    </div>
  );
}
