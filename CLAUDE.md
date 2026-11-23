@AGENTS.md

## Claude 전용

- 역할: 설계, 작업 분할, Codex 결과 리뷰. 큰 구현은 Codex(`/codex:rescue`)에 위임하고, 10분 내 작은 수정만 직접 처리
- 위임 시 대화 맥락이 전달되지 않으므로 설계는 `docs/`에 파일로 남기고 ID로 지시
- `Room.jsx`는 크므로 통째로 읽지 말고 Grep으로 위치를 찾은 뒤 필요한 범위만 읽기
