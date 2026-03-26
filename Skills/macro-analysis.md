# Skill: Macro Analysis 자동 업데이트

## 트리거 키워드
"매크로", "KOSIS", "경제지표", "매크로 업데이트"

## 자동화 수준
🟢 풀 자동 (Python + openpyxl)

## 전제 조건
- Python 3.x + pandas + openpyxl 설치됨
- SharePoint 동기화 활성화 (OneDrive 경로 자동 감지)
- KOSIS에서 데이터 다운로드 완료

## 실행 절차

### 1. KOSIS 데이터 준비
- KOSIS(국가통계포털)에서 `산업_규모별_고용_*.xlsx` 다운로드
- SharePoint > 4. Macro Analysis > 자동화 툴 > 01_KOSIS 데이터 폴더에 넣기

### 2. 실행
```bash
python update_macro.py
```

### 3. 자동 처리 내용
1. KOSIS 폴더에서 가장 최신 파일 자동 탐색
2. 새로 추가할 월 자동 감지
3. 10개 시트 자동 매칭 + 데이터 입력:
   - 빈일자리 (상용/임시일용)
   - 빈일자리율 (상용/임시일용)
   - 채용 (상용/임시일용)
   - 근로자 (상용/임시일용)
   - 입직자 (상용/임시일용)
4. 원본 Macro Analysis 엑셀에 직접 저장

### 4. 결과 확인
- 업데이트된 시트 수 + 건너뛴 시트 로그 출력
- Macro Analysis 엑셀 열어서 데이터 확인

## 파일 경로
- KOSIS 폴더: `~/OneDrive - 잡코리아/전략추진실 - 문서/4. Macro Analysis - 핵심 선후행 지표/자동화 툴/01_KOSIS 데이터`
- Macro 파일: `~/OneDrive - 잡코리아/전략추진실 - 문서/4. Macro Analysis - 핵심 선후행 지표/연습_✭Macro Analysis.xlsx`
- 경로는 사용자별 자동 감지 (`os.path.expanduser("~")`)

## 에러 핸들링
- "KOSIS 폴더가 없어" → SharePoint에 폴더 생성 필요
- "KOSIS 파일을 찾을 수 없어" → 파일명이 `산업_규모별_고용_*.xlsx` 패턴인지 확인
- "시트를 찾을 수 없어" → Macro 엑셀의 시트명이 SHEET_MAPPING과 일치하는지 확인

## 검증 방법
- 업데이트 후 Macro 엑셀에서 새 월 컬럼 확인
- 값이 KOSIS 원본과 일치하는지 샘플 체크
