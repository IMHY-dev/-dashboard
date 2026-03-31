"use client";

import { useState } from "react";
import Link from "next/link";

interface StepInfo {
  label: string;
  status: "pending" | "running" | "done" | "error";
}

const STEPS = [
  "PPT 파일 로드",
  "텍스트박스 크기 분석",
  "용어집 로드 (terminology.json)",
  "Claude API 번역 (병렬 처리)",
  "후처리 7개 규칙 적용",
  "번역 PPT 저장",
];

export default function TranslateAgent() {
  const [inputFile, setInputFile] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>(STEPS.map((s) => ({ label: s, status: "pending" })));
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleRun = async () => {
    if (!inputFile.trim()) {
      setError("입력 파일 경로를 지정해주세요.");
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
    }, 5000);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicFile: "fluid/ppt-translate", params: { input: inputFile } }),
      });
      const data = await res.json();
      clearInterval(interval);

      if (data.success) {
        setSteps(STEPS.map((s) => ({ label: s, status: "done" })));
        setLog(data.stdout || "번역 완료");
        setDone(true);
      } else {
        setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s)));
        setError(data.stderr || data.error || "번역 실패");
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
          <h1 className="text-2xl font-bold">🌐 장표 번역</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">● 활성</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          한글 PPT → 영문 PPT 번역 (Australian English, 용어집 + 후처리)
        </p>
      </div>

      {/* 입력 */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-muted)" }}>번역할 파일</h2>
        <p className="text-xs text-gray-500 mb-3">ppt-translater/input/ 폴더에 PPTX를 넣고 파일명을 입력하세요.</p>
        <div className="flex gap-3">
          <input
            value={inputFile}
            onChange={(e) => setInputFile(e.target.value)}
            placeholder="예: input/사업계획.pptx"
            className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-black border border-gray-700 text-white placeholder-gray-500"
          />
          <button
            onClick={handleRun}
            disabled={running || !inputFile}
            className={`px-8 py-2.5 rounded-lg text-sm font-medium transition-all ${running ? "bg-gray-700 text-gray-400 cursor-wait" : !inputFile ? "bg-gray-800 text-gray-500" : "text-black hover:opacity-80"}`}
            style={running || !inputFile ? {} : { background: "var(--accent)" }}
          >
            {running ? "⏳ 번역 중..." : "▶ 번역 시작"}
          </button>
        </div>
      </div>

      {/* 설정 안내 */}
      <div className="p-5 rounded-xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-muted)" }}>번역 설정</h2>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-gray-800/50">
            <div className="text-gray-500 mb-1">스타일</div>
            <div className="text-gray-300">Australian English</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50">
            <div className="text-gray-500 mb-1">모드</div>
            <div className="text-gray-300">Fast (배치 번역)</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50">
            <div className="text-gray-500 mb-1">후처리</div>
            <div className="text-gray-300">7개 규칙 자동 적용</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50">
            <div className="text-gray-500 mb-1">용어집</div>
            <div className="text-gray-300">terminology.json (18개 항목)</div>
          </div>
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
          <h2 className="text-sm font-medium mb-2 text-green-400">✅ 번역 완료</h2>
          <p className="text-xs text-gray-400 mb-2">결과: ppt-translater/output/ 폴더를 확인하세요.</p>
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
