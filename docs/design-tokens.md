# 디자인 토큰 (B 단계 설계)

`docs/design-improvements.md` B1~B6의 기준 문서. 구현은 이 문서의 이름·값을 그대로 사용한다. 여기에 없는 값이 필요하면 임의로 만들지 말고 보고한다.

현황 조사(2026-11-23, `src/` 전체 grep)
- 글자 크기 16종(7~25px), 11·10·12·13px가 전체의 85%
- 모서리 20종 이상(2~22px, 50%, 999), 굵기 500/600/650/700
- 여백 0~72px 사이 거의 모든 정수(5·7·9·11·13px 다수)
- 지속시간 20종 이상(120ms~2.6s), easing 10종 이상
- 테마 색은 페이지마다 따로 `getTheme()` 후 인라인 주입. 일부만 페이지별 CSS 변수(`--room-list-*`, `--quick-tool-*`, `--ui-mode-*`)

## 적용 원칙

1. 토큰은 모두 `src/index.css`의 `:root`에 정의한다. JSX 인라인 스타일에서도 `'var(--sp-3)'`처럼 변수로 참조한다.
2. **B 단계(B2·B3·B4·B6)는 기반만 만든다.** 변수 정의, 테마 → 변수 주입, reduced-motion 전역 규칙까지. 기존 화면의 값 교체는 C 단계에서 화면별로 한다. B 단계 후 화면 모양은 바뀌지 않아야 한다(B6 제외 — 모션 감소 설정 사용자에게만 차이).
3. 기존 `--ui-radius-*`, `--ui-motion-fast`, `--ui-control-height`, `--ui-shadow-float`는 새 토큰의 별칭으로 남겼다가 C 단계 마지막(classic 잔재 정리)에서 제거한다.
4. 연출(메시지 효과 `message-effect-*`, 텍스트 효과, 로딩 호흡)은 모션 토큰 예외. 단 reduced-motion 규칙은 적용.

---

## B1. 글자 크기 (6단계)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--fs-caption` | 11px | 시간, 배지 숫자, 카운터, 전송 상태. **최소 크기**(7~10px 폐지) |
| `--fs-label` | 12px | 칩, 소형 버튼, 탭 라벨, 폼 라벨 |
| `--fs-sub` | 13px | 보조 텍스트, 카드 설명, 목록 2행, 설정 항목 설명 |
| `--fs-body` | 15px | 본문, 말풍선, 나레이션, 목록 1행, 일반 버튼 |
| `--fs-title` | 17px | 화면 헤더 제목, 시트·모달 제목 |
| `--fs-display` | 22px | 빈 화면 안내 제목, 로고, 큰 숫자 |

- 입력 요소(`input`, `textarea`)는 단계와 무관하게 **16px 이상**(iOS 확대 방지, A3). 토큰 `--fs-input: 16px`.
- 사용자 글자 크기 설정(`--idea-font-scale`)은 지금처럼 **채팅 메시지 본문·나레이션·메시지 입력에만** 곱한다: `calc(var(--fs-body) * var(--idea-font-scale, 1))`. 입력은 `max(var(--fs-input), calc(var(--fs-body) * var(--idea-font-scale, 1)))`.
- 변경 영향: 말풍선 14→15px, 목록 보조 10~11→12~13px. 화면이 약간 커지므로 C 단계 화면별로 확인.
- 줄 높이: 본문·말풍선 1.55(현행 유지), 제목·라벨 1.3, 캡션 1.35. 토큰 `--lh-body: 1.55`, `--lh-tight: 1.3`.

## B2. 굵기·모서리·여백·그림자

굵기 (3종)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--fw-regular` | 400 | 본문 |
| `--fw-medium` | 500 | 라벨, 버튼, 강조 보조 |
| `--fw-semibold` | 600 | 제목, 이름, 기본 버튼 |

650·700은 600으로 통합.

모서리 (4종 + 원형)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-sm` | 8px | 칩, 배지, 작은 버튼, 썸네일 |
| `--radius-md` | 12px | 버튼, 입력, 말풍선, 메뉴 항목 |
| `--radius-lg` | 16px | 카드, 패널, 토스트 |
| `--radius-xl` | 20px | 바텀시트·모달 상단, 드로어 |
| `--radius-full` | 999px | 알약형 버튼, 토글, 아바타(원형은 `50%` 대신 이것 사용) |

말풍선 13→12px. 모서리 0(전체 화면 요소)은 토큰 없이 0 사용 가능.

여백 (4px 단위)

| 토큰 | 값 |
|---|---|
| `--sp-1` | 4px |
| `--sp-2` | 8px |
| `--sp-3` | 12px |
| `--sp-4` | 16px |
| `--sp-5` | 20px |
| `--sp-6` | 24px |
| `--sp-8` | 32px |
| `--sp-10` | 40px |

- 예외: 2px(아이콘 미세 정렬, 구분선 간격)만 토큰 없이 허용. 5·7·9·11·13px 등은 가까운 4의 배수로.
- 화면 좌우 기본 여백 `--sp-4`(16px), 카드 내부 `--sp-3`~`--sp-4`, 목록 항목 간 `--sp-2`.

크기

| 토큰 | 값 | 용도 |
|---|---|---|
| `--touch-min` | 44px | 탭 가능한 요소 최소 크기(C1 기준). 시각 크기가 작으면 패딩/의사 요소로 영역 확보 |
| `--control-h` | 44px | 버튼·입력 기본 높이 (`--ui-control-height` 대체) |
| `--control-h-sm` | 36px | 보조 버튼(터치 영역은 44px 확보) |

그림자 (2종)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-sm` | `0 2px 8px rgb(0 0 0 / 0.15)` | 카드 hover, 떠 있는 버튼 |
| `--shadow-lg` | `0 18px 50px rgb(0 0 0 / 0.3)` | 시트, 모달, 메뉴 (`--ui-shadow-float` 대체, modern 값) |

## B3. 모션

지속시간 (3단계)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--dur-fast` | 120ms | 눌림, hover, 색 변화, 토글 |
| `--dur-base` | 200ms | 페이드, 팝오버, 토스트, 작은 등장 |
| `--dur-slow` | 300ms | 바텀시트, 드로어, 큰 패널 |

easing (3종)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | 등장 |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | 퇴장 (퇴장은 등장보다 한 단계 짧게) |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 위치 이동, 토글 |

- 300ms 초과 UI 반응 금지. 예외: 메시지 연출, 로딩 반복 애니메이션, 스켈레톤 반짝임.
- `--ui-motion-fast`(160ms)는 `--dur-fast`의 별칭으로 바뀌므로 B3 커밋에서 해당 사용처는 120ms가 된다(체감 차이 미미, 허용).

## B4. 테마 → CSS 변수

주입 방식
- 새 파일 `src/lib/themeVars.js`: `themeToCssVars(theme)` (순수 함수, 테스트 대상) + `applyThemeVars(theme)` (`document.documentElement`에 설정, `data-theme-tone="dark|light"` 설정. `color-scheme`은 브라우저 기본 컨트롤 색까지 바뀌어 B4에서 보류, C 단계 컨트롤 정리 때 적용).
- 훅 `useThemeVars(theme)` (같은 파일, `useEffect([theme])`에서 `applyThemeVars` 호출, theme가 없으면 무시)를 각 페이지가 화면에 쓰는 테마(`t`)로 호출: Room, RoomList, Characters, CharacterEdit, CharacterTextEffects, Help, Settings. Room의 "공유 테마 따라가기"도 현재 적용 테마 기준. 설정의 테마 미리보기 카드처럼 현재 테마가 아닌 색은 적용하지 않는다.
- A6의 `--app-bg`(현재 App.jsx 시작 시에만 갱신)는 `--c-bg`로 통합. App.jsx 시작 시 캐시 테마로 `applyThemeVars` 1회 호출, 이후 페이지 훅이 갱신(A6 미완 부분 해결).
- 페이지별 변수(`--room-list-*`, `--quick-tool-*`, `--ui-mode-*`)는 B4에서 건드리지 않는다. C 단계 각 화면에서 `--c-*`로 교체 후 제거(인라인 주입을 없애는 순간 첫 렌더 색이 달라질 수 있어 화면 단위로 확인).
- 인라인 `t.xxx` 사용처 교체는 C 단계. B4는 변수만 존재하게 한다.

역할별 변수 (테마 객체에서)

| 변수 | 테마 키 | 역할 |
|---|---|---|
| `--c-bg` | `bg` | 화면 배경 |
| `--c-surface` | `panel` | 카드, 헤더, 시트 |
| `--c-border` | `border` | 구분선, 테두리 |
| `--c-accent` | `point` | 강조, 기본 버튼, 선택 상태 |
| `--c-text` | `theirText` | 본문 텍스트 |
| `--c-text-sub` | `subText` | 보조 텍스트 |
| `--c-narration` | `narrColor` | 나레이션 |
| `--c-chapter` | `chapColor` | 챕터 구분 |
| `--c-bubble-mine` | `myBubble` | 내 말풍선 |
| `--c-bubble-mine-text` | `myText` | 내 말풍선 글자 |
| `--c-bubble-mine-act` | `myAct` | 내 말풍선 행동 묘사 |
| `--c-bubble-their` | `theirBubble` | 상대 말풍선 |
| `--c-bubble-their-text` | `theirText` | 상대 말풍선 글자 |
| `--c-bubble-their-border` | `theirBorder` | 상대 말풍선 테두리 |
| `--c-input-bg` | `inputBg` | 입력창 배경 |
| `--c-input-text` | `inputText` | 입력창 글자 |

파생 변수 (테마 키 없음, `themeToCssVars`가 계산 또는 CSS에서 정의)

| 변수 | 값 | 대체 대상 (B5) |
|---|---|---|
| `--c-on-accent` | `point` 위 대비가 큰 쪽: `#ffffff` 또는 `#111111` (계산) | `background: t.point` 위 `#fff` |
| `--c-accent-soft` | `color-mix(in srgb, var(--c-accent) 15%, transparent)` | `${t.point}22` 류 |
| `--c-danger` | 다크 `#f87171` / 라이트 `#dc2626` | `#f87171`, `#ef7777`, `#e5484d` |
| `--c-on-danger` | 다크 `#111111` / 라이트 `#ffffff` | danger 배경 위 글자 |
| `--c-danger-soft` | `color-mix(in srgb, var(--c-danger) 12%, transparent)` | `#ef44441c`, `#f8717114` |
| `--c-success` | 다크 `#4ade80` / 라이트 `#16a34a` | `#26a65b` 등 |
| `--c-overlay` | `rgb(0 0 0 / 0.5)` | 모달 배경 rgba |
| `--c-on-media` | `#ffffff` | 이미지 뷰어 등 항상 어두운 배경 위 글자(테마 무관) |
| `--c-pressed` | 다크 `rgb(255 255 255 / 0.08)` / 라이트 `rgb(0 0 0 / 0.06)` | 눌림·hover 덧칠 |

- 다크/라이트 구분은 테마의 `dark` 키 → `:root[data-theme-tone="light"]`에서 위 값 재정의.
- 테마 목록 미리보기(설정의 테마 선택 카드)처럼 **현재 테마가 아닌** 테마 색을 그리는 곳은 인라인 유지(예외).

## B5. 하드코딩 색 정리

C 단계 각 화면 작업에서 함께 처리. 대응표는 B4 파생 변수 표. 표에 없는 색(`#aaaaaa`, `#7f77dd`, `#333333` 등 테마 기본값 fallback)은 해당 역할 변수로 교체. 판단 불가 시 보고.

## B6. reduced-motion 전면화

`src/index.css` 끝에 전역 규칙 1개로 통합:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- 기존 3개 블록 중 위 규칙과 중복되는 부분은 제거, 고유한 대체 표현(예: 정지 상태 스타일)은 유지.
- JS 스크롤(`scrollIntoView({ behavior: 'smooth' })` 등)은 `prefers-reduced-motion` 시 `'auto'`로. 공용 헬퍼 `prefersReducedMotion()`을 `src/lib/`에 두고 사용.
- 메시지 연출은 reduced-motion 시 움직임 없이 최종 상태(색·굵기 등)만 표시. `useMessageStageEffects`의 기존 처리 유지.
- 컴포넌트 내 `<style>` 키프레임(Room.jsx, Characters.jsx)의 `index.css` 이동은 C 단계.

---

## 확정 사항 (2026-11-23 사용자 확인 완료)

1. 본문 15px (말풍선 14→15px)
2. 말풍선 모서리 13→12px (`--radius-md`)
3. 최소 글자 11px (현재 7~10px 사용처 약 90곳이 커짐)
4. `--c-on-accent` 자동 계산(밝은 강조색 테마는 버튼 글자가 검정이 됨)
5. 라이트 테마 `--c-danger` `#dc2626` (현재 `#f87171`은 라이트 배경에서 대비 약 2.8)

---

## C5. 공통 컴포넌트 명세 (`src/components/ui.jsx`)

모든 컴포넌트는 `index.css`의 `.ui-*` 클래스 + 토큰으로 스타일을 정의하고, JSX 인라인 스타일은 쓰지 않는다(위치·크기 조정용 `style`/`className` 전달은 허용). 색은 `--c-*` 변수만 사용. 테마 객체 prop은 받지 않는다(기존 `IconButton`의 색 prop은 하위 호환으로 유지하되 없으면 변수 사용).

| 컴포넌트 | 클래스 | 명세 |
|---|---|---|
| `Button` | `.ui-btn` + `--primary` / `--secondary` / `--ghost` / `--danger`, `--sm`, `--block` | 높이 `--control-h`(sm `--control-h-sm`, 터치 영역은 `::before`로 44px 확보), 좌우 `--sp-4`(sm `--sp-3`), `--radius-md`, 글자 `--fs-body`(sm `--fs-label`), primary `--fw-semibold` 나머지 `--fw-medium`. primary: 배경 `--c-accent`, 글자 `--c-on-accent`. secondary: 배경 `--c-surface`, 테두리 `--c-border`, 글자 `--c-text`. ghost: 투명, 글자 `--c-text`. danger: 배경 `--c-danger`, 글자 `--c-on-danger`(다크 `#111111` / 라이트 `#ffffff`, 파생 변수로 추가 — `#f87171` 위 흰 글자는 대비 2.8로 미달). disabled: opacity 0.5, 눌림 효과 없음. `type="button"` 기본 |
| `IconButton` | `.ui-icon-btn` (+ `--active`) | 시각 40px, 터치 44px, `--radius-md`, 테두리 `--c-border`, 아이콘 색 `--c-text-sub`. active: 테두리·아이콘 `--c-accent`, 배경 `--c-accent-soft`. `label` 필수(aria-label) |
| `TextInput`, `TextArea` | `.ui-input` | 배경 `--c-input-bg`, 글자 `--c-input-text`, 테두리 `--c-border`, `--radius-md`, 글자 `--fs-input`, 높이 `--control-h`(TextArea는 min-height만), 좌우 `--sp-3`. focus: 테두리 `--c-accent` + `box-shadow: 0 0 0 3px var(--c-accent-soft)`. placeholder `--c-text-sub` |
| `Card` (기존 `Surface` 대체, `Surface`는 별칭 export 유지) | `.ui-card` (+ `--interactive`) | 배경 `--c-surface`, 테두리 1px `--c-border`, `--radius-lg`, 안쪽 여백 `--sp-4`. interactive: 눌림 피드백(A4 규칙에 포함) |
| `Toggle` | `.ui-switch` | `<button role="switch" aria-checked>`. 트랙 40×22, `--radius-full`, 켬 `--c-accent` / 끔 `--c-border`. 손잡이 16px, 색 `#ffffff`(예외 허용), `transform` 이동, `--dur-fast` `--ease-in-out`. 터치 영역 44px. props: `checked`, `onChange(next)`, `label`(aria-label), `disabled` |
| `Dialog` | `.ui-dialog-backdrop`, `.ui-dialog` (기존 클래스 재사용·토큰화) | 배경막 `--c-overlay`, 패널 `--c-surface`, `--radius-xl`, `--shadow-lg`, 여백 `--sp-5`. 제목 `--fs-title` `--fw-semibold` `--c-text`, 설명 `--fs-sub` `--c-text-sub`. 등장 `--dur-base` `--ease-out`. Esc 닫기, 열릴 때 포커스 이동·닫힐 때 복귀, 배경막 클릭 닫기(옵션) — 현 `ConfirmDialog` 동작 그대로 |

- `ConfirmDialog`는 `Dialog` + `Button` 으로 재구성(외부 API·동작 동일). danger 확인 버튼은 `Button --danger`(현재 `#d84f57` → `--c-danger`).
- 화면별 기존 마크업을 공통 컴포넌트로 바꾸는 작업은 C1~C4에서 한다.
