"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface ChatMessage {
  role: "user" | "agent" | "system";
  content: string;
  step?: number;
  data?: Record<string, unknown>;
}

const STEP_LABELS = [
  "", // 0 placeholder
  "입력 분석",
  "명확화 질문",
  "헤드메시지 초안",
  "사용자 확정",
  "레이아웃 선택",
  "레이아웃 확정",
  "PPTX 생성",
  "완료",
];

export default function CreateAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      content: "장표 제작 Agent입니다. 만들고 싶은 장표의 맥락, 트랜스크립트, 또는 초안을 입력해주세요.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(`ppt-${Date.now()}`);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [outputPath, setOutputPath] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (userInput?: string) => {
    const text = userInput || input.trim();
    if (!text || loading) return;

    // 사용자 메시지 추가
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const nextStep = currentStep === 0 ? 1 : currentStep;

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicFile: "fluid/ppt-create",
          params: {
            session: sessionId,
            step: String(nextStep),
            input: text,
          },
        }),
      });
      const data = await res.json();

      if (data.success && data.stdout) {
        try {
          const parsed = JSON.parse(data.stdout);
          const agentMsg: ChatMessage = {
            role: "agent",
            content: "",
            step: parsed.step,
            data: parsed.data,
          };

          // 메시지 구성
          let content = parsed.message || "";
          if (parsed.data?.headMessages) {
            content += "\n\n**헤드메시지 초안:**\n";
            const hms = parsed.data.headMessages as { slide: number; message: string; layout?: string }[];
            hms.forEach((h, i) => {
              content += `${i + 1}. ${h.message}${h.layout ? ` [${h.layout}]` : ""}\n`;
            });
          }
          if (parsed.data?.questions) {
            content += "\n\n";
            const qs = parsed.data.questions as string[];
            qs.forEach((q, i) => { content += `${i + 1}. ${q}\n`; });
          }
          if (parsed.data?.layouts) {
            content += "\n\n**레이아웃 매칭:**\n";
            const lts = parsed.data.layouts as { slide: number; layout: string; reason: string }[];
            lts.forEach((l) => { content += `- 슬라이드 ${l.slide}: ${l.layout} (${l.reason})\n`; });
          }
          if (parsed.data?.outputPath) {
            setOutputPath(parsed.data.outputPath as string);
            content += `\n\n📁 **파일 저장 완료:** ${parsed.data.outputPath}`;
          }
          if (parsed.prompt) {
            content += `\n\n💬 ${parsed.prompt}`;
          }

          agentMsg.content = content;
          setMessages([...newMessages, agentMsg]);
          setCurrentStep(parsed.nextStep || parsed.step + 1);

          // 확인이 필요 없는 단계는 자동 진행
          if (!parsed.needsInput && parsed.nextStep && parsed.nextStep <= 8) {
            // 약간의 딜레이 후 자동 진행
            setTimeout(() => {
              autoAdvance(parsed.nextStep, [...newMessages, agentMsg]);
            }, 1000);
          }
        } catch {
          // JSON 파싱 실패 시 raw 출력
          setMessages([...newMessages, { role: "agent", content: data.stdout.slice(0, 1000) }]);
        }
      } else {
        setMessages([
          ...newMessages,
          { role: "agent", content: `❌ ${data.stderr || data.error || "실행 실패"}` },
        ]);
      }
    } catch (err) {
      setMessages([...newMessages, { role: "agent", content: `❌ 서버 연결 실패: ${err}` }]);
    } finally {
      setLoading(false);
    }
  };

  const autoAdvance = async (step: number, prevMessages: ChatMessage[]) => {
    setLoading(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicFile: "fluid/ppt-create",
          params: { session: sessionId, step: String(step), input: "" },
        }),
      });
      const data = await res.json();
      if (data.success && data.stdout) {
        try {
          const parsed = JSON.parse(data.stdout);
          let content = parsed.message || "";
          if (parsed.data?.outputPath) {
            setOutputPath(parsed.data.outputPath as string);
            content += `\n\n📁 **파일 저장 완료:** ${parsed.data.outputPath}`;
          }
          if (parsed.prompt) content += `\n\n💬 ${parsed.prompt}`;

          const agentMsg: ChatMessage = { role: "agent", content, step: parsed.step, data: parsed.data };
          setMessages([...prevMessages, agentMsg]);
          setCurrentStep(parsed.nextStep || parsed.step + 1);

          if (!parsed.needsInput && parsed.nextStep && parsed.nextStep <= 8) {
            setTimeout(() => autoAdvance(parsed.nextStep, [...prevMessages, agentMsg]), 1000);
          }
        } catch {
          setMessages([...prevMessages, { role: "agent", content: data.stdout.slice(0, 1000) }]);
        }
      }
    } catch (err) {
      setMessages([...prevMessages, { role: "agent", content: `❌ ${err}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="p-6 pb-0">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-all">← 대시보드</Link>
        <div className="mt-4 mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">🎨 장표 제작</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">● 활성</span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              맥락 → 8단계 워크플로우 → PPTX 자동 생성
            </p>
          </div>
          {/* 단계 표시 */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  s < currentStep ? "bg-green-500 text-black" :
                  s === currentStep ? "bg-yellow-500 text-black" :
                  "bg-gray-700 text-gray-500"
                }`}
                title={STEP_LABELS[s]}
              >
                {s < currentStep ? "✓" : s}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{ maxHeight: "calc(100vh - 240px)" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] p-4 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : msg.role === "system"
                  ? "bg-gray-800 text-gray-300 rounded-bl-md"
                  : "bg-gray-800 text-gray-200 rounded-bl-md border border-gray-700"
              }`}
            >
              {msg.step && (
                <div className="text-xs text-gray-500 mb-2">
                  Step {msg.step}: {STEP_LABELS[msg.step] || ""}
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-400 p-4 rounded-2xl rounded-bl-md text-sm animate-pulse">
              ⏳ 처리 중...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="p-6 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        {outputPath ? (
          <div className="text-center py-4">
            <div className="text-green-400 text-sm mb-2">✅ PPTX 생성 완료</div>
            <code className="text-xs text-gray-400">{outputPath}</code>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={currentStep === 0 ? "장표에 담을 맥락을 입력하세요..." : currentStep === 4 || currentStep === 6 ? "'확정' 또는 수정사항 입력..." : "답변을 입력하세요..."}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl text-sm bg-black border border-gray-700 text-white placeholder-gray-500 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${loading || !input.trim() ? "bg-gray-700 text-gray-500" : "text-black hover:opacity-80"}`}
              style={loading || !input.trim() ? {} : { background: "var(--accent)" }}
            >
              전송
            </button>
            {(currentStep === 4 || currentStep === 6) && (
              <button
                onClick={() => sendMessage("확정")}
                disabled={loading}
                className="px-6 py-3 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-500 transition-all"
              >
                확정
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
