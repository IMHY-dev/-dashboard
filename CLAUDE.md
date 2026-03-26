# 전략추진실 인턴 워크스페이스

## 미션
전략추진실의 정형 업무를 자동 처리하는 통합 워크스페이스.
업무 들어오면: 자동 분류 → 맥락 로드 → Skill 실행 → 결과 생성.
사람은 검수하고 가이드만 준다.

## 파이프라인
1. **분류** — 요청을 라우팅 테이블에서 매칭 (Context/Topics/index.md)
2. **맥락** — State(항상) + 해당 Topic 로드
3. **실행** — Skill/코드의 절차대로 실행
4. **프리뷰** — 결과를 사용자에게 보여줌
5. **완료** — 승인 시 산출물 저장

## Context 로딩
- 항상: `Context/State/01_Team_Context.md`
- 업무 요청: `Context/Topics/index.md` → 관련 Topic 선택 로드
- 사업 분석: Topic 내 관련 파일

## 라우팅 테이블

| 키워드 | Topic | Skill/코드 | 수준 |
|--------|-------|-----------|:----:|
| 플레이스먼트, RMS, 서베이 | placement-survey | (Placement 코드 — 추후 연결) | 🟢 |
| 매크로, KOSIS, 경제지표 | macro-analysis | `update_macro.py` | 🟢 |
| 장표, PPT, 덱 | ppt-work | Claude/Genspark | 🟢 |
| 번역, 영문 | ppt-work | `ppt-translate/translate.py` | 🟢 |
| 품의, 예산, 구매 | budget-procurement | `node fill.js <문서유형>` | 🟢 |
| 회의록, 싱크 | meeting-notes | `meeting-notes/summarize.py` | 🟢 |
| Concur, 송장 | concur | (가이드 생성) | 🟢 |
| 인보이스, 구독 | invoice-update | 리마인드만 | 🟡 |
| 기프티콘, 네이버페이 | gifticon | 절차 가이드만 | 🟡 |
| BCG, 컨설팅 | bcg-support | 알림 + Context 로드 | 🟡 |

## 코드 자산

### 전자결재 자동화 (`fill.js`)
Playwright 브라우저 자동화. 예산품의/구매품의를 자동 입력.
```bash
node fill.js <문서유형> [옵션]
# ats-b/p: ATS 기프티콘 예산/구매품의
# survey-b/p: Placement Survey 예산/구매품의
# free-b/p: 산학협력 예산/구매품의
# --dry-run: 제출 전 검토
```

### 장표 번역 (`ppt-translate/`)
Claude API + python-pptx. 용어집 기반 한→영 번역.
```bash
cd ppt-translate
python translate.py --input input/파일.pptx --output output/파일_en.pptx
```
- 텍스트박스 크기 제약 자동 계산
- terminology.json 용어집 적용
- Australian English 스타일

### Macro 업데이트 (`update_macro.py`)
KOSIS 데이터를 Macro Analysis 엑셀에 자동 반영.
```bash
python update_macro.py
```
- KOSIS 폴더에 `산업_규모별_고용_*.xlsx` 넣고 실행
- 10개 시트 자동 매칭 (빈일자리, 채용, 근로자, 입직자 × 상용/임시일용)
- SharePoint 경로 자동 감지

### 회의록 정리 (`meeting-notes/`)
TXT 녹취록 → Claude 구조화 요약 → Notion 등록.
```bash
cd meeting-notes
python summarize.py input/회의록.txt           # 요약만
python summarize.py input/회의록.txt --notion   # Notion에도 등록
```
- 업무 지시 추출 → 대시보드 업무 대기목록 연동
- 방향성 변화 추출 → Team Context 업데이트 재료
- output/pending_actions.json에 대시보드 연동 항목 누적

### 대시보드 (`dashboard/`)
Next.js + Tailwind 기반 업무 관리 UI.
```bash
cd dashboard
npm install && npm run dev
```
- 업무 대기목록 (슬랙 기반 입력 → 라우팅 → 자동/수동 분기)
- 회의록 업로드 → 자동 요약 → 업무 추출 → 대시보드 연동
- 지식 베이스 (수동 업무 절차 가이드)
- 에이전트 실행 현황 (6개 중 4개 구현)

## 업무 원칙
1. Context만 받고 스스로 답 찾기
2. 막히면 빠르게 Align
3. AI 적극 활용, 생각하면서 일하기
4. 우선순위: ①긴급 ②정기(매크로/플레이스먼트) ③AI 전환·사업 공부

## 폴더 구조
```
worxphere-auto/
├── CLAUDE.md                    ← 이 파일 (마스터 설정)
├── Context/
│   ├── State/
│   │   └── 01_Team_Context.md   ← 팀 정체성, 업무 방식, 방향성 로그
│   └── Topics/
│       ├── index.md             ← 라우팅 테이블
│       ├── placement-survey.md
│       ├── macro-analysis.md
│       ├── ppt-work.md
│       ├── budget-procurement.md
│       ├── meeting-notes.md
│       ├── concur.md
│       ├── invoice-update.md
│       ├── gifticon.md
│       └── bcg-support.md
├── fill.js                      ← 전자결재 자동화
├── auto.js, server.js           ← 품의 서버/자동화
├── config/templates.js          ← 품의 템플릿
├── ppt-translate/               ← 장표 번역
│   ├── translate.py
│   ├── terminology.json
│   └── SYSTEM_PROMPT.txt
├── update_macro.py              ← Macro KOSIS 업데이트
├── meeting-notes/               ← 회의록 정리
│   ├── summarize.py
│   ├── input/                   ← TXT 녹취록 넣기
│   └── output/                  ← JSON 요약 + pending_actions
├── dashboard/                   ← 업무 관리 대시보드 (Next.js)
│   ├── app/page.tsx             ← 메인 UI
│   └── app/globals.css
└── respository/                 ← SQL 쿼리
```
