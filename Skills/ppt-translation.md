# Skill: 장표 번역 자동화

## 트리거 키워드
"번역", "영문", "English", "translate"

## 자동화 수준
🟢 풀 자동 (Claude API + python-pptx)

## 전제 조건
- Python 3.x 설치됨
- `pip install -r ppt-translate/requirements.txt` 완료
- `.env` 파일에 ANTHROPIC_API_KEY 설정

## 실행 절차

### 1. 입력 파일 준비
- 번역할 PPT 파일을 `ppt-translate/input/`에 위치

### 2. 실행
```bash
cd ppt-translate
python translate.py --input input/파일명.pptx --output output/파일명_en.pptx
```

### 3. 결과 확인
- `ppt-translate/output/`에 번역된 PPT + 번역 리포트 생성
- 리포트: 슬라이드별 원문/번역문/글자수 제약 초과 여부

### 4. 사용자 검수
- 글자수 초과(⚠) 표시된 슬라이드 확인
- 용어집 미적용 항목 확인

## 핵심 기능

### 텍스트박스 크기 제약 (box_analyzer.py)
- 텍스트박스 너비/폰트 크기로 최대 글자수 자동 계산
- 번역 결과가 초과하면 ⚠ 표시

### 후처리 자동 수정 (post_processor.py)
1. fix_billion — 억/조 단위 오류 교정
2. fix_duplicates — 연속 중복 제거
3. fix_month_abbrev — 월 약어 오류
4. fix_currency_order — 통화 코드 위치
5. fix_australian_spelling — 호주식 철자

### 용어집 (terminology.json)
- ko_to_en / en_to_ko 방향별 매핑
- preserve 리스트 (APAC, KPI 등 원문 유지)
- 새 용어 추가 시 terminology.json 직접 편집

## 에러 핸들링
- API 키 오류 → .env 확인
- 글자수 초과 다수 → 폰트 크기 또는 번역 스타일 조정

## 번역 규칙
- Australian English (colour, organisation, analyse)
- 채용/HR 전문 용어 우선
- 원문 서식(불릿, 줄바꿈) 유지
- 모델: claude-sonnet-4-6
