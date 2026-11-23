# 기능 지도

"이 기능이 이미 있나? 어디 있나?"를 찾기 위한 목록. 동작 설명은 코드를 볼 것.
줄 번호 대신 함수·컴포넌트 이름을 적는다 (Grep으로 찾기). 기능을 추가·삭제하는 PR에서 함께 갱신.

## 라우트 (`src/App.jsx`)

`/auth` 인증 · `/` 방 목록 · `/room/:roomId` 채팅방 · `/room/:roomId/characters` 방 캐릭터 풀 · `/characters` 캐릭터 · `/characters/:id/edit` 캐릭터 편집 · `/characters/:id/text-effects` 텍스트 효과 · `/settings` 설정 · `/help` 도움말

전역: `PwaPrompts`(설치·업데이트 안내), 글꼴 배율 `--idea-font-scale`, UI 모드(`lib/uiMode.js`): **modern 고정**, classic 폐지 (`UiModeToggleCard` 삭제, `data-ui-mode` 참조 CSS 없음 — `uiMode.js`는 부팅 호출만 남음). 디자인 토큰·테마 CSS 변수: `docs/design-tokens.md`, `lib/themeVars.js`(`useThemeVars`), 공통 UI `components/ui.jsx`

## 채팅방 `src/pages/Room.jsx`

| 기능 | 위치 |
|---|---|
| 헤더, 초대 코드 패널, 테마 패널, 검색 패널, 날짜 이동 패널 | JSX 주석 `{/* 헤더 */}` 등 |
| 메시지 불러오기 / 이전 메시지 | `fetchMessages`, `loadOlderMessages` |
| 전송 (낙관적 전송, 오프라인 대기, 재시도) | `sendMessage`, `persistMessage`, `retryMessage`, `features/messages/pendingMessageStore.js` |
| 전송 상태 (전송 중 / 실패+재시도 / 업로드 진행률) | `renderDeliveryStatus` |
| 수정 / 삭제 | `startEditingMessage`, `editMessage`, `deleteMessage` |
| 길게 누르기 메뉴 | `startLongPress`, `moveLongPress`, `cancelLongPress` |
| 전송 버튼 길게 눌러 연출 선택 | `startSendButtonPress` ~ `handleSendButtonClick`, `openMessageEffectPicker` |
| 읽음 처리 / 읽음 커서 | `markAsRead`, `refreshReadCursors` |
| 새 대화 알림 버튼 | `newMsgAlert`, `scrollToBottom`, `handleScroll` |
| 입력 중 표시 (대사 / 나레이션) | `handleTyping`, JSX `{/* 입력중 표시 */}` |
| 대사 / 나레이션 모드, 캐릭터 선택 | `chooseCharacter`, `toggleTopCharacterPicker`, `openCharList` |
| 이미지 전송, 갤러리 | `sendImage`, `sendImages`, `deleteGalleryImage`, `closeGalleryPanel` |
| 챕터 구분선 | `sendDivider` |
| 북마크 | `toggleMessageBookmark`, `jumpToBookmarkedMessage`, `bookmarkPreview` |
| 방 이름, 공유 테마, 테마 따르기 | `saveRoomName`, `saveSharedTheme`, `toggleFollow` |
| 초대 (코드 복사, 다른 방으로 초대) | `copyInviteCode`, `sendRoomInvite`, `enterInvitedRoom` |
| 대화 내보내기 | `exportChat` |
| 방 나가기 | `leaveRoom` |
| 하단 도구 시트 (드래그) | `startToolSheetDrag`, `closeRoleplayMenu` |
| 빠른 도구 (즐겨찾기) | `selectQuickTool`, `toggleQuickToolFavorite`, `components/QuickToolPicker.jsx`, `features/rooms/quickToolPreferences.js` |
| 말하는 아바타 (GIF 프레임) | `loadTalkingFrames`, `talkingAvatarUrl` |

빠른 도구 종류: `narration` `image` `divider` `effects` `random` `communication` `locations` `notes` `audio` `invite`

## 채팅방 하위 컴포넌트 `src/components/`

| 컴포넌트 | 기능 |
|---|---|
| `MessageEffects.jsx` | 메시지 연출 선택·표시 (`MessageEffectPicker`, `MessageEffectBubble`). 연출은 외침(`shout`)·충격(`impact`)만. 속삭임·떨림·독백은 D4에서 제거(과거 메시지는 일반 표시, DB 허용값은 유지) |
| `AnimatedMessageText.jsx` | 캐릭터별 텍스트 등장 효과 |
| `RandomTools.jsx` | 주사위·확률 등 랜덤 도구 (`shareRandomResult`) |
| `CommunicationSessions.jsx`, `CommunicationRecord.jsx` | 전화·문자 연출 |
| `RoomWorldPanel.jsx` | 장면과 기록 (장소 추가·설명) |
| `SharedBackgroundAudio.jsx` | 공유 배경음, 플레이리스트 |
| `EntryCharacterPicker.jsx` | 방 입장 시 캐릭터 선택 |
| `ProfileImageModal.jsx` | 프로필 이미지 크게 보기 |
| `RoomGroupPicker.jsx`, `RoomGroupCreatePanel.jsx` | 방 그룹 선택·생성 |
| `ConfirmDialog.jsx` + `hooks/useConfirmDialog.js` | 확인 대화상자 |
| `Toast.jsx` + `hooks/useToast.js` | 토스트 알림 |
| `LoadingScreen.jsx` | 전체 화면 로딩 (앱 첫 진입, 캐릭터 편집·텍스트 효과) |
| `Skeletons.jsx` | 스켈레톤 로딩: 방 목록·채팅방·캐릭터 목록 (D3) |
| `ui.jsx` | 기본 UI: `Button`, `IconButton`, `TextInput`, `TextArea`, `Card`(`Surface`), `Toggle`, `Dialog`, `Skeleton` |
| `TextEffectConfigurator.jsx` | 텍스트 효과 설정 UI |
| `hooks/useMessageStageEffects.js` | 충격 연출 화면 흔들림 |

## 방 목록 `src/pages/RoomList.jsx`

방 생성 `createRoom` · 초대 코드 입장 `joinRoom` · 즐겨찾기 `toggleFavorite` · 정렬 `changeSortMode` · 그룹 추가/삭제/접기 `addRoomGroup` `removeRoomGroup` `toggleRoomGroup` · 그룹 이동 `moveRoom` · 드래그 정렬 `handleRoomDragEnd` · 방 삭제 `deleteRoom` · 카드 `renderRoomCard`
로직: `features/rooms/roomGroups.js`, `features/rooms/roomSummary.js`(정렬·안 읽은 수)

## 캐릭터

- `Characters.jsx`: 목록, 추가 `addChar`, 수정 `saveEdit`, 삭제 `deleteChar`, 보관·복원 `fetchArchived` `restoreChar`, 이미지 크롭 `confirmCrop`, 말하는 프레임 업로드·정렬 `uploadTalkingFrames` `reorderTalkingFrames`, 전역·방별 드래그 정렬, 방 캐릭터 풀 `saveRoomCharacterPool`
- `CharacterEdit.jsx`: 단일 캐릭터 편집, 프레임 추가·삭제
- `CharacterTextEffects.jsx`: 캐릭터별 텍스트 효과 (`features/messages/textEffectSettings.js`)
- 이미지 크롭: `lib/profileImageCrop.js`

## 설정 `src/pages/Settings.jsx`

테마 `saveTheme` · 글꼴 `saveFont` · 글꼴 크기 `saveFontScale` · 푸시 알림 `togglePush` · 로그아웃 `handleLogout`

## 기타

- 인증 `Auth.jsx` (`handleSubmit`), 도움말 `Help.jsx`
- Supabase 클라이언트·업로드·푸시 `lib/supabase.js` / 테마 정의 `lib/themes.js`
- 메시지 API `features/messages/messageApi.js`, 병합·정렬 `messageState.js`
- 관리자 앱 `admin/src/App.jsx` (별도 빌드, `/idea/admin/`)
- Push Edge Function `supabase/functions/send-push/`, Service Worker `public/sw.js`
