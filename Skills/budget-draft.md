# Skill: 예산·구매 품의 자동화

## 트리거 키워드
"품의", "예산품의", "구매품의", "전자결재"

## 자동화 수준
🟢 풀 자동 (Playwright 브라우저 자동화)

## 전제 조건
- Node.js 설치됨
- `npm install` 완료 (최초 1회)
- `npm run install-browser` 완료 (Playwright 브라우저)
- `.env` 파일에 WORXPHERE_ID / WORXPHERE_PW 설정

## 지원 문서 유형

| 커맨드 | 문서 | 주요 옵션 |
|--------|------|-----------|
| `ats-b` | ATS 기프티콘 예산품의 | --nq (네이버페이 수량), --sq (스타벅스 수량) |
| `ats-p` | ATS 기프티콘 구매품의 | --nq, --sq |
| `survey-b` | Placement Survey 예산품의 | --yr (연도) |
| `survey-p` | Placement Survey 구매품의 | --yr, --amt (금액) |
| `free-b` | 산학협력 프리랜서 예산품의 | --amt, --n (인원), --weeks |
| `free-p` | 산학협력 프리랜서 구매품의 | --sup (공급사), --st/--en (계약기간) |
| `interview-b` | 산학협력 인터뷰 예산품의 | --n30, --n60 (인원), --rate30/--rate60 |

## 실행 절차

### 1. 사용자에게 확인할 것
- 어떤 문서 유형인지 (위 표 참조)
- 필요한 옵션값 (수량, 금액, 날짜 등)

### 2. 실행 (반드시 --dry-run 먼저)
```bash
cd /path/to/workspace
node fill.js <문서유형> [옵션] --dry-run
```

### 3. 사용자 검수
- --dry-run으로 폼이 정확히 채워졌는지 확인 요청
- 스크린샷 또는 직접 확인

### 4. 실제 제출
```bash
node fill.js <문서유형> [옵션]
```

## 에러 핸들링
- 셀렉터 불일치 → `error_screenshot.png` 확인 → fill.js 해당 함수 셀렉터 수정
- 로그인 실패 → .env 파일 ID/PW 확인
- 예산 연동 오류 → 코스트센터/GL계정 확인 (templates.js 기본값 참조)

## 검증 방법
- --dry-run으로 폼 상태 확인
- 전자결재 시스템에서 문건 상태 확인

## 주의사항
- **반드시 --dry-run 먼저** — 실제 제출은 검수 후
- .env 파일은 Git에 올리지 않음
- 기안자 기본값: 이창준(ats), 주호연(survey/interview), 임성욱(free)
