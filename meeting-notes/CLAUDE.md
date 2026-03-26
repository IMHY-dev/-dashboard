# 회의록 정리 에이전트

## 사용법
```bash
cd meeting-notes
python summarize.py input/회의록.txt           # 요약만
python summarize.py input/회의록.txt --notion   # Notion에도 등록
python summarize.py input/회의록.txt --dry-run  # 테스트
```

## 입력
- `input/` 폴더에 TXT 녹취록 넣기
- 인코딩: UTF-8, CP949, EUC-KR, UTF-16 자동 감지

## 출력
1. 콘솔에 구조화 요약 출력
2. `output/YYYY-MM-DD_파일명.json` 저장
3. `output/pending_actions.json`에 대시보드 연동 항목 누적
4. `--notion` 시 Notion Meeting Notes DB에 페이지 생성

## 추출 항목
- 구조화 요약 (주제/결정사항)
- 업무 지시 (누가 → 누구에게 → 무엇을 → 언제까지)
- 방향성 변화 (팀 리더의 기대/역할 변화 → Team Context 업데이트 재료)
- 대시보드 연동 항목 (자동으로 업무 대기목록에 추가 가능)

## 환경 변수 (.env)
```
ANTHROPIC_API_KEY=sk-ant-xxxxx
NOTION_API_KEY=ntn_xxxxx          # --notion 사용 시
NOTION_DATABASE_ID=xxxxx          # --notion 사용 시
```
