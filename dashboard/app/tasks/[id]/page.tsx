"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type TaskStatus = "pending" | "in_progress" | "done";
type AutoLevel = "auto" | "manual" | "knowledge";

interface Task {
  id: string;
  from: string;
  to: string;
  message: string;
  category: string;
  startDate: string;
  deadline: string;
  status: TaskStatus;
  autoLevel: AutoLevel;
  guide: string;
  channel: string;
  timestamp: string;
  notes?: string[];
}

function calcDday(deadline: string): string | null {
  if (!deadline || deadline === "미정") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "D-day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

const ROUTING: Record<string, { category: string; autoLevel: AutoLevel; guide: string; steps: string[] }> = {
  "플레이스먼트|RMS|서베이|26Q": { category: "Placement 분석", autoLevel: "auto", guide: "Raw → run_jk/am → calc_rms → gen_ppt", steps: ["Raw 데이터 로드", "분류표 매칭 (run_jk.py)", "미분류 리포트 생성", "RMS 계산 (calc_rms.py)", "PPT 생성 (gen_ppt.py)"] },
  "매크로|KOSIS|경제지표": { category: "Macro 분석", autoLevel: "auto", guide: "python update_macro.py", steps: ["KOSIS 파일 탐색", "데이터 읽기", "Macro 엑셀 열기", "10개 시트 업데이트", "저장"] },
  "장표|PPT|덱|슬라이드": { category: "장표 제작", autoLevel: "auto", guide: "Claude/Genspark 기반 PPT 생성", steps: ["스토리라인 생성", "슬라이드 구성", "데이터 삽입", "디자인 적용", "PPT 저장"] },
  "번역|영문|English|translate": { category: "장표 번역", autoLevel: "auto", guide: "python ppt-translate/translate.py", steps: ["PPT 파일 로드", "텍스트박스 크기 분석", "용어집 로드", "Claude API 번역", "후처리 적용", "번역 PPT 저장"] },
  "품의|예산|구매|전자결재": { category: "예산·구매 품의", autoLevel: "auto", guide: "node fill.js <문서유형> --dry-run", steps: ["문서유형 판단", "템플릿 로드", "폼 자동 입력 (dry-run)", "사용자 검수", "실제 제출"] },
  "회의록|싱크|미팅노트": { category: "회의록 생성", autoLevel: "auto", guide: "python meeting-notes/summarize.py", steps: ["TXT 파일 읽기", "구조화 요약 생성", "업무지시/방향성 추출", "프리뷰 생성", "Notion 등록"] },
  "나인하이어|에스크로|스톡옵션|매매대금": { category: "나인하이어 지급", autoLevel: "manual", guide: "에스크로 수수료 → 주식매매대금 → 스톡옵션 순서 진행", steps: ["에스크로 수수료 지급 (매년 12월)", "재직 여부 확인: 정승현/이예린/최돈민/이경환", "주식 매매대금 지급", "스톡옵션 보상 지급: 김재인/안정태/이정욱"] },
  "산학|EGI|MCSA|프리랜서": { category: "산학협력 계약", autoLevel: "manual", guide: "예산품의→구매검토→구매품의→인장→계약 체결 (5단계)", steps: ["예산품의 작성", "구매검토 요청 (총무팀 이민희님 메일)", "구매품의 작성 (예산품의 하위문건)", "인장관리 (CSO 서명)", "계약 체결"] },
  "Concur|송장|세금계산서": { category: "Concur 처리", autoLevel: "manual", guide: "담당자 변경 → 연동 송장 마무리 → 제출", steps: ["재무회계팀에 송장 담당자 변경 요청", "연동 송장으로 처리"] },
};

function matchCategory(text: string) {
  for (const [keywords, info] of Object.entries(ROUTING)) {
    const regex = new RegExp(keywords.split("|").join("|"), "i");
    if (regex.test(text)) return info;
  }
  return { category: "미분류", autoLevel: "manual" as AutoLevel, guide: "매뉴얼에 없는 업무입니다. 창준님께 확인하세요.", steps: [] };
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        const found = data.tasks?.find((t: { id: string }) => t.id === params.id);
        if (found) {
          const matched = matchCategory(found.message);
          setTask({
            ...found,
            category: matched.category,
            autoLevel: matched.autoLevel,
            guide: matched.guide,
            startDate: found.startDate || "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  const updateStatus = (status: TaskStatus) => {
    if (!task) return;
    setTask({ ...task, status });
    fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status }),
    }).catch(() => {});
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
      불러오는 중...
    </div>
  );

  if (!task) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-sm" style={{ color: "var(--text-muted)" }}>업무를 찾을 수 없습니다.</div>
      <button onClick={() => router.push("/")} className="px-4 py-2 rounded-lg text-sm text-black font-medium" style={{ background: "var(--accent)" }}>
        ← 메인으로
      </button>
    </div>
  );

  const dday = calcDday(task.deadline);
  const ddayColor = !dday ? "var(--text-muted)" : dday === "D-day" ? "#f59e0b" : dday.startsWith("D+") ? "#ef4444" : parseInt(dday.replace("D-", "")) <= 3 ? "#f97316" : "#9ca3af";
  const matched = matchCategory(task.message);

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      {/* 뒤로가기 */}
      <button onClick={() => router.push("/")}
        className="flex items-center gap-1 text-sm mb-6 hover:opacity-80 transition-all"
        style={{ color: "var(--text-muted)" }}>
        ← 업무 목록
      </button>

      {/* 헤더 */}
      <div className="p-5 rounded-2xl mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-xs rounded border bg-blue-500/20 text-blue-400 border-blue-500/30">진행중</span>
            <span className={`px-2 py-0.5 text-xs rounded border ${task.autoLevel === "auto" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}`}>
              {task.autoLevel === "auto" ? "🟢 자동" : "🟡 수동"}
            </span>
            <h1 className="text-lg font-bold">{task.category}</h1>
          </div>
          {dday && (
            <span className="text-sm font-bold px-2 py-1 rounded" style={{ color: ddayColor, background: `${ddayColor}22` }}>
              {dday}
            </span>
          )}
        </div>

        <p className="text-sm mb-3 text-gray-200">&ldquo;{task.message}&rdquo;</p>

        <div className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>지시자: <strong className="text-white">{task.from}</strong></span>
          <span>수행자: <strong className="text-white">{task.to}</strong></span>
          {task.startDate && <span>시작: <strong className="text-white">{task.startDate}</strong></span>}
          <span>마감: <strong className="text-white">{task.deadline}</strong></span>
          <span>{task.channel} · {task.timestamp}</span>
        </div>

        {task.notes && task.notes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {task.notes.map((note, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700">{note}</span>
            ))}
          </div>
        )}
      </div>

      {/* 작업 계획 */}
      <div className="p-5 rounded-2xl mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--accent)" }}>작업 계획</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>진행방법: {task.guide}</p>

        {matched.steps.length > 0 ? (
          <div className="space-y-2">
            {matched.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl text-sm"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-black"
                  style={{ background: "var(--accent)" }}>{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 rounded-xl text-sm" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            수동 진행 업무입니다. 아래 가이드를 참고하세요.
          </div>
        )}
      </div>

      {/* 과거 맥락 (placeholder) */}
      <div className="p-5 rounded-2xl mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--accent)" }}>과거 맥락</h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>슬랙·싱크 기반 이전 작업 이력 (준비 중)</p>
        <div className="p-3 rounded-xl text-xs text-gray-500 text-center" style={{ border: "1px dashed var(--border)" }}>
          노션 Meeting Notes 연동 후 자동 표시 예정
        </div>
      </div>

      {/* 현재 맥락 (placeholder) */}
      <div className="p-5 rounded-2xl mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--accent)" }}>현재 맥락</h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>슬랙 스레드 기반 추가 정보</p>
        {task.notes && task.notes.length > 0 ? (
          <div className="space-y-1">
            {task.notes.map((note, i) => (
              <div key={i} className="p-2 rounded text-xs text-gray-300" style={{ background: "var(--bg)" }}>· {note}</div>
            ))}
          </div>
        ) : (
          <div className="p-3 rounded-xl text-xs text-gray-500 text-center" style={{ border: "1px dashed var(--border)" }}>
            슬랙 스레드 댓글이 없습니다
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <button onClick={() => { updateStatus("pending"); router.push("/"); }}
          className="px-4 py-2 rounded-lg text-sm border border-gray-700 text-gray-400 hover:bg-gray-800 transition-all">
          ↩ 대기로 되돌리기
        </button>
        <button onClick={() => { updateStatus("done"); router.push("/"); }}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-black transition-all hover:opacity-80"
          style={{ background: "var(--accent)" }}>
          완료 처리 →
        </button>
      </div>
    </div>
  );
}
