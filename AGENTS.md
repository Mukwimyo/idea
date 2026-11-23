# Idea

캐릭터 롤플레잉 실시간 채팅 웹앱 (PWA). React 19 + Vite 8 + React Router 7 + Supabase(Auth, DB, Realtime, Storage, Edge Functions). JavaScript(JSX), TypeScript 아님.

## 명령어

- `npm run dev` — 개발 서버 (`/idea/` 경로)
- `npm run lint` — ESLint
- `npm run test:run` — Vitest 1회 실행
- `npm run check` — lint + test + 앱/관리자 빌드. **작업 완료 기준**
- `scripts/verify-*`, `test:rls` 등은 실제 Supabase가 필요하므로 실행하지 않는다.

## 구조

- `src/pages/` — 화면. `Room.jsx`(채팅방, 3천 줄)가 핵심
- `src/components/` — 공용 컴포넌트, `ui.jsx`는 기본 UI 요소
- `src/features/{messages,rooms,characters}/` — 도메인 로직 + 테스트
- `src/lib/themes.js` — 테마 15개 정의 / `src/lib/supabase.js` — 클라이언트
- `src/index.css` — 전역 스타일, 키프레임, `:root` 토큰
- `admin/` — 별도 관리자 앱 / `supabase/` — 마이그레이션, Edge Function

## 규칙

- Prettier: 세미콜론 없음, 작은따옴표, 2칸 들여쓰기
- 테스트는 대상 파일 옆 `*.test.js(x)`
- UI 문구는 한국어
- 기존 스타일은 대부분 인라인 `style={{}}`이며 테마 객체(`t`/`th`)에서 색을 받는다. 새 스타일은 가능하면 `index.css` 클래스 + CSS 변수로 작성
- 디자인 작업은 `docs/design-improvements.md`의 ID(A1, B2 등) 기준으로 진행
- 기능 위치는 `docs/FEATURE_MAP.md` 참고. 기능을 추가·삭제하면 같은 PR에서 이 파일도 갱신

## 배포

- `main` push → GitHub Actions(`.github/workflows/deploy.yml`)가 `npm run check` 후 GitHub Pages에 **즉시 운영 배포**
- PR은 검증(`check`)만 실행, 배포 안 함
- 따라서 작업은 항상 브랜치(`codex/<작업명>`)에서 하고 PR로 병합. `main`에 직접 커밋·push 금지
- base path는 `/idea/` (변경 시 `vite.config.js`, Router `basename`, PWA 경로 함께 수정)

## 금지

- `.env` 읽기·수정·커밋 금지
- `supabase/migrations/` 수정 금지 (운영 적용 절차는 `docs/GOAL_A_RUNBOOK.md`)
- 요청 범위 밖의 기능 동작 변경 금지. 판단이 필요하면 임의로 정하지 말고 보고

## 역할 분담

설계·리뷰는 Claude, 구현은 Codex가 맡는다. Codex는 지시받은 ID 범위만 구현하고, 설계와 맞지 않는 부분은 우회하지 말고 보고한다.
