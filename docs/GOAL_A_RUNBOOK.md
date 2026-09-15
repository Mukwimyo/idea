# 목표 A 운영 적용 및 검증 기록

## 현재 상태

- 작성 기준일: 2026-09-15 (Asia/Seoul)
- 앱 저장소: `Mukwimyo/idea`
- 앱 Supabase 프로젝트: `IDEA` (`tngszaqvvcjdxntrtlvv`)
- 위키 Supabase 프로젝트 `IDEA WIKI` (`hdeisnyeefpkvgtieaoo`)와 혼동하지 않는다.
- 운영 DB와 GitHub Pages에는 목표 A 변경을 아직 적용하지 않았다.
- 로컬 구현 브랜치: `codex/hardening-a`

## 배포 및 되돌림 기준선

2026-09-15에 GitHub API를 읽기 전용으로 확인했다.

- 저장소 `Mukwimyo/idea`는 공개 저장소이며 기본 브랜치는 `main`이다.
- 원격 `main` 기준 커밋: `233924682805b9c7803ab3a4cc3aea60b68e0890`
- 마지막 성공한 GitHub Pages 실행도 위 `main` 커밋을 사용했다.
- 현재 `gh-pages` 기준 커밋: `972fec833aa370cc684c1ef1560140c02b1bfb86`
- Pages 주소는 `https://mukwimyo.github.io/idea/`이고 `gh-pages` 루트에서 제공된다.
- Actions에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` 이름의 비밀값이 모두 등록되어 있다. 값 자체는 조회하지 않았다.

앱 되돌림은 위 운영 `main` 커밋을 기준으로 새 Pages 배포를 실행하는 방식으로 한다. `gh-pages` 커밋을 직접 수정하거나 강제 푸시하지 않는다.

## 운영 DB 기준선

Supabase 대시보드에서 시스템 카탈로그를 읽기 전용으로 조회했다. 사용자 메시지 본문이나 계정 정보는 조회하지 않았다.

- 현재 공개 스키마에는 21개 테이블이 있다.
- `messages.read_by`의 실제 형식은 `text[]`이다.
- Supabase migration history에는 기존 변경 이력이 등록되어 있지 않다. 따라서 전체 `supabase db push`를 바로 실행하지 않는다.
- 다음 핵심 테이블은 정책이 존재하지만 RLS가 꺼져 있다.
  - `bookmarks`
  - `character_groups`
  - `characters`
  - `groups`
  - `messages`
  - `profiles`
  - `push_subscriptions`
  - `room_members`
  - `rooms`
- `room_members_select` 정책에는 `rm.room_id = rm.room_id` 자기 비교가 있어 다른 방 구성원 노출 위험이 있다.
- `rooms_select`와 `rooms_update`에도 잘못된 열 비교가 중복 정책으로 남아 있다.
- 메시지 INSERT 정책 하나는 `user_id = auth.uid()`를 강제하지 않아 발신자 위조 가능성이 있다.
- `idea-uploads`는 공개 버킷이고 크기·MIME 제한이 없으며, 기존 정책은 누구나 업로드할 수 있게 허용한다.
- 일부 `security definer` 함수의 `search_path`가 `public`만 사용한다.
- `is_idea_admin(uuid)`는 호출자가 다른 사용자 ID의 관리자 여부를 물을 수 있다.
- `room_members(room_id, user_id)`에는 고유 제약이 없어 적용 전 중복 검사가 필요하다.

### 2026-09-15 읽기 전용 사전 점검

운영 프로젝트의 집계값과 제약 정의만 조회했으며 행의 본문이나 사용자 식별 정보는 읽지 않았다.

- 방 15개, 방 구성원 행 31개, 메시지 4,324개가 있다.
- 현재 데이터베이스 사용량은 17,296,531바이트(약 16.5MiB)다.
- 중복된 `(room_id, user_id)` 구성원 행: 0개
- 실제 사용자와 일치하지 않는 `messages.read_by` 값: 0개
- 방 또는 발신자가 비어 있는 메시지: 각각 0개
- 발신자가 해당 방의 구성원이 아닌 메시지: 0개
- `groups.type`의 실제 허용값은 `personal`, `room`이며 재현 기준선도 이에 맞췄다.

따라서 현재 데이터만 놓고 보면 `202609140001`의 고유 인덱스 생성과 읽음 커서 변환을 중단시킬 알려진 데이터 조건은 없다. 이 결과는 SQL 구문 전체의 실행 가능성이나 RLS 동작을 증명하지 않으므로, 백업과 단계별 적용 후 검증은 여전히 필수다.

## 로컬 마이그레이션 구성

1. `202607010000_legacy_core_schema.sql`
   - 운영에 이미 존재하는 핵심 테이블을 `if not exists`로 재구성한다.
   - 기존 운영 테이블이나 행을 변경하지 않고 새 환경 재현성을 확보한다.
2. 기존 2026-07~08 마이그레이션
   - 캐릭터 풀, 입력 상태, 연락, 배경음, 관리자, 북마크, 장소, 재생목록을 구성한다.
3. `202609140001_message_delivery_and_read_cursors.sql`
   - 메시지 클라이언트 ID와 서버 순번을 추가한다.
   - 기존 `read_by text[]`를 사용자별 읽음 커서로 보존 변환한다.
   - 멱등 전송 및 단조 증가 읽음 RPC를 추가한다.
4. `202609140002_room_summaries.sql`
   - 방 목록과 안 읽은 수를 한 번에 조회하는 RPC를 추가한다.
5. `202609140003_enable_core_rls.sql`
   - 핵심 테이블의 RLS를 켜고 잘못된 정책을 교체한다.
   - 방 참여를 초대 코드 기반 원자적 RPC로 제한한다.
   - 메시지·방·멤버의 식별 열 변경을 트리거로 막는다.
   - Storage 쓰기를 본인 또는 방 구성원 경로로 제한한다.
   - 공개 읽기는 기존 URL 호환을 위해 이번 목표에서 유지한다.

## 운영 적용 전 필수 점검

다음 항목이 하나라도 충족되지 않으면 적용하지 않는다.

- Supabase의 수동 백업 또는 논리 덤프를 확보한다. Free 플랜 대시보드는 예약 백업이 없으므로 별도 덤프가 필요하다. 운영 메시지가 포함된 덤프를 OneDrive에 평문 저장하지 않는다.
- 2026-09-15 사전 점검에서 아래 쿼리는 0행이었다. 적용 직전에도 다시 확인한다.

```sql
select room_id, user_id, count(*)
from public.room_members
group by room_id, user_id
having count(*) > 1;
```

- `messages.read_by`에 실제 사용자 UUID 문자열이 아닌 값이 없는지 확인한다.
- 두 테스트 계정이 같은 테스트 방에 가입되어 있고, 발신자만 가입된 별도 비공개 테스트 방을 준비한다.
- GitHub Actions의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`가 설정되어 있는지 확인한다.
- 현재 운영 커밋과 되돌릴 커밋 SHA를 기록한다.

## 권장 적용 순서

운영 변경은 사용자 확인을 받은 뒤에만 수행한다.

1. 운영 DB 백업을 확보한다.
2. 기준선 파일은 운영에서 생성문이 모두 무시되는지 검토한다.
3. `202609140001`과 `202609140002`만 먼저 트랜잭션으로 적용한다.
4. `supabase/tests/database/goal_a_contract.sql` 중 새 메시지 구조 관련 항목을 확인한다.
5. 테스트 방에서 `npm run test:two-account`를 실행한다.
6. 앱 브랜치를 배포 가능한 저장소에 푸시하고 검증 작업이 통과하는지 확인한다.
7. 앱을 배포한다.
8. 즉시 `202609140003` RLS 마이그레이션을 적용한다.
9. 전체 DB 계약 검사와 아래 실사용 시나리오를 수행한다.
10. 30분 동안 오류와 Realtime 연결 상태를 관찰한다.

전체 마이그레이션 이력이 운영 DB에 기록되어 있지 않으므로, 이번 적용에서는 파일별 SQL 실행과 결과 기록을 사용한다. 검증 후 별도 작업으로 migration history를 정렬한다.

## 두 계정 검증 환경 변수

테스트 전용 계정과 방만 사용한다. 스크립트는 테스트 메시지를 삭제하지 않는다.

```text
TEST_SUPABASE_URL
TEST_SUPABASE_ANON_KEY
TEST_SENDER_EMAIL
TEST_SENDER_PASSWORD
TEST_READER_EMAIL
TEST_READER_PASSWORD
TEST_ROOM_ID
TEST_PRIVATE_ROOM_ID
TEST_SENDER_CHARACTER_ID (선택)
TEST_MESSAGE_COUNT (기본 100)
```

실행 명령은 `npm run test:two-account`와 `npm run test:rls`다. RLS 검사는 발신자만 가입된 `TEST_PRIVATE_ROOM_ID`에 추적 가능한 테스트 메시지 한 건을 남기며 자동 삭제하지 않는다. 통과 조건은 다음과 같다.

- 같은 클라이언트 ID를 동시에 두 번 보내도 서버 행은 하나다.
- 100개 클라이언트 ID마다 서로 다른 서버 ID와 순번이 하나씩 존재한다.
- Realtime 이벤트가 일부 누락되어도 최종 조회에는 100개가 모두 존재한다.
- 수신자의 읽음 커서가 마지막 서버 순번까지 전진한다.
- 발신자 계정에서도 그 읽음 커서를 조회할 수 있다.
- 비회원 계정은 비공개 방·메시지·다른 프로필을 읽거나 메시지·읽음 커서를 쓸 수 없다.
- 일반 계정은 관리자 RPC를 호출하거나 임의 Storage 경로에 쓸 수 없다.

추가 실사용 검증:

- 수신자 탭이 백그라운드면 읽음 표시가 생기지 않는다.
- 수신자가 메시지 하단을 실제로 본 뒤 발신자 화면에 읽음 또는 인원수가 표시된다.
- 수신자 탭을 5분간 백그라운드에 둔 뒤 복귀하면 최신 메시지와 읽음 상태가 수렴한다.
- 네트워크를 끊고 보낸 텍스트가 실패 상태와 재시도 버튼을 유지한다.
- 온라인 복귀 후 재시도해도 메시지가 하나만 생긴다.
- 같은 계정의 두 기기에서 오래된 메시지를 열어도 읽음 위치가 뒤로 가지 않는다.

## 되돌리기

- 앱 이상: GitHub Pages를 직전 운영 커밋으로 다시 배포한다.
- `202609140001/002` 이상: 새 열과 테이블은 기존 클라이언트가 사용하지 않으므로 우선 앱만 되돌리고 DB 구조는 보존한다. 데이터를 확인하기 전에 열이나 커서 행을 삭제하지 않는다.
- RLS 적용 후 기능 차단: 원인을 특정한 테이블의 정책만 교정한다. 전체 RLS를 일괄 해제하지 않는다.
- 보안상 긴급하고 교정이 불가능한 경우에만 영향 테이블을 하나씩 RLS 이전 상태로 되돌리고, 시간·사유·대상 테이블을 기록한다.
- 메시지 순번과 읽음 커서는 삭제하지 않는다. 기존 `read_by`가 유지되어 이전 앱으로 돌아갈 수 있다.

## 남은 위험

- 공개 Storage URL을 이미 메시지와 캐릭터 데이터에 저장하므로, 버킷 비공개 전환은 URL 마이그레이션과 서명 URL 계층이 필요한 별도 작업이다.
- 방 구성원은 연락 상태 기록 호환을 위해 같은 방 메시지의 내용·읽음 필드를 갱신할 수 있다. 식별 열 위조는 트리거로 차단하지만 내용 수정 권한의 완전 분리는 후속 서버 RPC가 필요하다.
- 이미지 업로드 성공 후 메시지 저장 실패 시 고아 파일 자동 정리는 아직 없다.
- 운영 migration history가 비어 있어 신규 환경 재현은 개선됐지만 운영 이력과 로컬 파일의 자동 일치는 아직 확정되지 않았다.
