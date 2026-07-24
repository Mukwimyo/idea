# Idea

캐릭터를 선택해 함께 이야기를 이어가는 실시간 롤플레잉 채팅 웹앱입니다. 사용자는 자신의 캐릭터를 만들고, 초대 코드로 채팅방에 참여해 대사·서술·이미지를 주고받을 수 있습니다.

## 주요 기능

- 이메일 기반 회원가입 및 로그인
- 채팅방 생성, 초대 코드 입장, 방 대표 이미지 설정
- 캐릭터 생성·수정·보관 및 프로필 이미지 업로드
- Supabase Realtime 기반 실시간 메시지와 입력 중 상태 표시
- 캐릭터 대사, 서술, 이미지 메시지 작성
- 메시지 수정, 읽음 상태, 안 읽은 메시지 수 표시
- 챕터 구분과 방별 연출·테마 설정
- 전역 테마와 글꼴 설정
- PWA 설치 및 Web Push 알림

## 기술 스택

- React 19
- Vite 8
- React Router
- Supabase Auth, Database, Realtime, Storage, Edge Functions
- Lucide React
- Web Push / Service Worker

## 시작하기

### 요구 사항

- Node.js 20 이상
- npm
- Supabase 프로젝트

### 설치

```bash
git clone https://github.com/Mukwimyo/idea.git
cd idea
npm install
```

프로젝트 루트에 `.env` 파일을 만들고 다음 값을 입력합니다.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
```

개발 서버를 실행합니다.

```bash
npm run dev
```

기본 Vite 개발 서버 주소에서 `/idea/` 경로로 접속합니다.

## 사용 가능한 명령어

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 검사
npm run preview  # 빌드 결과 미리보기
```

## Supabase 구성

프런트엔드는 다음 테이블과 스토리지를 사용합니다.

- `profiles`: 사용자 테마, 글꼴, 알림 및 입장 연출 설정
- `rooms`: 채팅방 정보, 초대 코드, 대표 이미지와 방별 설정
- `room_members`: 방 참여자, 최근 캐릭터와 입력 중 상태
- `characters`: 사용자 캐릭터와 프로필 정보
- `messages`: 대사, 서술, 이미지, 챕터 메시지
- `push_subscriptions`: Web Push 구독 정보
- `idea-uploads`: 캐릭터·메시지·방 이미지 저장 버킷

Web Push를 사용하려면 `supabase/functions/send-push` Edge Function에 아래 시크릿도 설정해야 합니다.

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
PUSH_WEBHOOK_SECRET=...
```

`send-push`를 호출하는 Supabase Database Webhook에는 `x-webhook-secret` 헤더를 추가하고, 값은 `PUSH_WEBHOOK_SECRET`과 동일하게 설정해야 합니다. 이 값은 클라이언트 환경 변수에 넣거나 저장소에 커밋하지 마세요.

데이터베이스 스키마와 RLS 정책은 저장소에 마이그레이션 파일로 포함되어 있지 않습니다. 새 Supabase 프로젝트에 배포할 때는 위 리소스와 접근 정책을 별도로 구성해야 합니다.

## 프로젝트 구조

```text
src/
├─ lib/
│  ├─ supabase.js       # Supabase 클라이언트, 업로드, Push 구독
│  └─ themes.js         # 테마 정의
├─ pages/
│  ├─ Auth.jsx          # 인증
│  ├─ RoomList.jsx      # 채팅방 목록과 생성·입장
│  ├─ Room.jsx          # 실시간 채팅
│  ├─ Characters.jsx    # 캐릭터 관리
│  └─ Settings.jsx      # 테마, 글꼴, 알림 설정
├─ App.jsx              # 인증 상태와 라우팅
└─ main.jsx             # 애플리케이션 진입점

public/
├─ manifest.json        # PWA 매니페스트
└─ sw.js                # Push 알림 Service Worker

supabase/functions/send-push/
└─ index.ts             # Push 알림 Edge Function
```

## 배포

Vite의 base path가 `/idea/`로 설정되어 있어 GitHub Pages와 같은 하위 경로 배포를 기준으로 합니다.

```bash
npm run build
```

생성된 `dist/` 디렉터리를 정적 호스팅 서비스에 배포하세요. 다른 경로에 배포한다면 `vite.config.js`, React Router의 `basename`, PWA 경로를 함께 수정해야 합니다.

## 라이선스

현재 별도의 라이선스가 명시되어 있지 않습니다.
