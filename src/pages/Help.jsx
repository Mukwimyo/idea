import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUp,
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronUp,
  CircleHelp,
  CirclePlus,
  Copy,
  DoorOpen,
  Download,
  FolderPlus,
  GripVertical,
  Images,
  LogIn,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Music,
  Paperclip,
  Phone,
  Search,
  Settings,
  Sparkles,
  Star,
  UserPlus,
  WifiOff,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DEFAULT_THEME_ID, getTheme } from '../lib/themes'

const Section = ({ title, children, theme }) => (
  <section className="help-section" style={{ marginBottom: 28 }}>
    <h2 style={{ margin: '0 0 10px', color: theme.theirText, fontSize: 15 }}>{title}</h2>
    <div style={{ display: 'grid', gap: 9 }}>{children}</div>
  </section>
)

const GuideCard = ({ title, description, children, theme }) => (
  <article className="help-guide-card" style={{ padding: 14, borderRadius: 13, border: `1px solid ${theme.border}`, background: theme.panel }}>
    <h3 style={{ margin: 0, color: theme.theirText, fontSize: 13, fontWeight: 600 }}>{title}</h3>
    {description && <p style={{ margin: '5px 0 0', color: theme.subText, fontSize: 11, lineHeight: 1.7 }}>{description}</p>}
    {children && <div style={{ marginTop: 12 }}>{children}</div>}
  </article>
)

const IconSample = ({ icon, label, theme, active = false }) => (
  <div style={{ display: 'grid', justifyItems: 'center', gap: 5, minWidth: 48 }}>
    <div style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 10, color: active ? theme.point : theme.subText, background: active ? `${theme.point}1f` : 'transparent' }}>{icon}</div>
    <span style={{ color: theme.subText, fontSize: 9, textAlign: 'center', lineHeight: 1.35 }}>{label}</span>
  </div>
)

const IconRow = ({ theme, items }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: 10 }}>
    {items.map(([icon, label, active]) => <IconSample key={label} icon={icon} label={label} theme={theme} active={active} />)}
  </div>
)

export default function Help() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => getTheme(localStorage.getItem('idea-theme-id') || DEFAULT_THEME_ID))

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).maybeSingle()
      if (active) setTheme(getTheme(data?.theme_id || DEFAULT_THEME_ID))
    })
    return () => { active = false }
  }, [])

  const t = theme

  return (
    <div className="settings-page-drawer modern-surface-page help-page" style={{ position: 'fixed', inset: 0, zIndex: 100, overflowY: 'auto', background: t.bg, color: t.theirText }}>
      <div className="modern-page-shell" style={{ width: '100%', maxWidth: 520, minHeight: '100dvh', margin: '0 auto', padding: '14px 16px 42px', boxSizing: 'border-box' }}>
        <header className="modern-page-header" style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, margin: '-14px -16px 22px', padding: '12px 16px', background: `color-mix(in srgb, ${t.panel} 88%, transparent)`, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', border: 0, background: 'none', color: t.subText }}><ChevronLeft size={22} /></button>
          <div>
            <h1 style={{ margin: 0, color: t.theirText, fontSize: 16 }}>IDEA 사용법</h1>
            <div style={{ marginTop: 3, color: t.subText, fontSize: 10 }}>방과 캐릭터를 정리하고, 함께 역극을 이어가는 방법</div>
          </div>
        </header>

        <Section title="1. 대화방 만들기와 정리" theme={t}>
          <GuideCard title="새 방을 만들거나 초대 코드로 입장" description="메인 화면의 ‘새 대화’를 눌러 방 만들기 또는 초대 코드 입장을 선택하세요. 초대로 들어갈 때는 입장에 사용할 캐릭터를 고릅니다. 이 캐릭터 이름이 입장 알림에도 표시돼요." theme={t}>
            <IconRow theme={t} items={[[<CirclePlus size={17} />, '새 대화'], [<LogIn size={17} />, '초대 코드'], [<UserPlus size={17} />, '입장 캐릭터']]} />
          </GuideCard>
          <GuideCard title="그룹·검색·정렬·즐겨찾기" description="‘새 그룹’으로 방을 분류하고, 방 카드 메뉴에서 다른 그룹으로 옮기거나 즐겨찾기에 추가할 수 있어요. 검색은 방 이름과 그룹 이름을 찾습니다. 최근 대화순과 직접 정렬을 바꿀 수 있으며, 직접 정렬에서는 손잡이를 끌어 순서를 조정합니다." theme={t}>
            <IconRow theme={t} items={[[<FolderPlus size={17} />, '새 그룹'], [<Search size={17} />, '방 검색'], [<GripVertical size={17} />, '직접 정렬'], [<Star size={17} fill="currentColor" />, '즐겨찾기', true]]} />
          </GuideCard>
        </Section>

        <Section title="2. 캐릭터와 프로필" theme={t}>
          <GuideCard title="캐릭터 만들기와 방별 목록 설정" description="메인 화면의 ‘캐릭터’에서 이름·설명·프로필 사진을 관리합니다. 각 방의 ‘설정’에서는 그 방에서 사용할 캐릭터를 추가·제외하고 순서를 바꿀 수 있어요. 방에는 최소 한 명의 캐릭터가 필요합니다. ‘가나다순 보기’는 표시만 바꾸며 저장 순서는 바꾸지 않습니다." theme={t} />
          <GuideCard title="대화 중 화자 바꾸기와 프로필 수정" description="입력창의 현재 캐릭터 이름·사진 버튼을 눌러 다른 캐릭터를 선택하세요. 내가 보낸 대사의 프로필 사진을 누르고 ‘프로필 수정’을 선택하면 해당 캐릭터의 별도 수정 페이지로 이동합니다." theme={t}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: t.subText, fontSize: 10 }}><ChevronUp size={16} color={t.point} />입력창 프로필을 위로 밀어도 캐릭터 선택 목록이 열립니다.</div>
          </GuideCard>
          <GuideCard title="캐릭터별 대사 연출과 말하기 프레임" description="프로필 수정에서 ‘채팅 등장 효과’를 열어 캐릭터별 대사 연출을 설정할 수 있습니다. 새로 보내는 대사부터 적용돼요. 입 모양 프레임을 최대 4장 등록하면 캐릭터가 입력 중일 때 프로필 사진이 말하는 것처럼 바뀝니다." theme={t}>
            <IconRow theme={t} items={[[<Sparkles size={17} />, '대사 연출'], [<MessageSquare size={17} />, '말하기 프레임']]} />
          </GuideCard>
        </Section>

        <Section title="3. 메시지와 이미지" theme={t}>
          <GuideCard title="메시지 보내기·수정·삭제" description="입력창에 내용을 쓰고 전송 버튼을 누릅니다. 내 메시지를 길게 누르면 수정·삭제 메뉴가 열려요. 인터넷 연결이 끊겨 전송에 실패한 메시지는 실패 상태로 남으며, 연결을 복구한 뒤 다시 보낼 수 있습니다." theme={t}>
            <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 20, border: `1px solid ${t.border}`, background: t.bg }}>
              <span style={{ flex: 1, color: t.subText, fontSize: 11 }}>메시지 입력…</span>
              <span style={{ width: 29, height: 29, display: 'grid', placeItems: 'center', borderRadius: '50%', background: t.point, color: '#fff' }}><ArrowUp size={15} /></span>
            </div>
          </GuideCard>
          <GuideCard title="이미지 여러 장 보내기와 갤러리" description="입력창의 도구 메뉴에서 이미지를 선택하면 여러 장을 한 묶음으로 보낼 수 있어요. 상단 갤러리에서는 공유 이미지를 날짜별로 보고 크게 열 수 있습니다. 내가 보낸 이미지 묶음은 길게 눌러 이미지별로 삭제할 수 있어요." theme={t}>
            <IconRow theme={t} items={[[<Paperclip size={17} />, '이미지 첨부'], [<Images size={17} />, '대화방 갤러리']]} />
          </GuideCard>
          <GuideCard title="중요 대사 북마크와 과거 기록 찾기" description="메시지를 길게 눌러 중요 대사로 북마크하고, 상단 북마크 아이콘에서 저장한 대사로 다시 이동할 수 있어요. 상단 검색은 방 안의 대사를 찾고, 방 설정의 ‘날짜로 이동’은 기록이 있는 날짜를 골라 이동합니다." theme={t}>
            <IconRow theme={t} items={[[<Bookmark size={17} />, '중요 대사'], [<Search size={17} />, '대사 검색'], [<CalendarDays size={17} />, '날짜로 이동']]} />
          </GuideCard>
          <GuideCard title="오래된 메시지 이어서 불러오기" description="최근 대화부터 표시됩니다. 대화 목록 맨 위에 있는 ‘이전 메시지 불러오기’를 누르면 더 오래된 기록을 페이지 단위로 이어서 가져올 수 있어요. 메시지가 많이 쌓인 방도 과거 대화를 차례로 확인할 수 있습니다." theme={t}>
            <IconRow theme={t} items={[[<ArrowUp size={17} />, '목록 위쪽'], [<MessageSquare size={17} />, '이전 메시지 불러오기']]} />
          </GuideCard>
        </Section>

        <Section title="4. 역극 도구" theme={t}>
          <GuideCard title="도구 메뉴와 빠른 실행" description="입력창 왼쪽의 격자 버튼을 누르면 역극 도구가 열립니다. 자주 쓰는 도구는 즐겨찾기에 추가할 수 있어요. 입력창의 빠른 실행 버튼을 누르면 현재 도구가 실행되고, 버튼을 위로 밀면 즐겨찾기 도구를 바꿀 수 있습니다." theme={t}>
            <IconRow theme={t} items={[[<Sparkles size={17} />, '대사 연출'], [<Music size={17} />, '공유 배경음'], [<MapPin size={17} />, '장소·장면'], [<MoreHorizontal size={17} />, '랜덤 도구']]} />
          </GuideCard>
          <GuideCard title="나레이션·구분선·전화와 문자" description="나레이션으로 전환해 지문을 보내거나 문구가 있는 구분선을 추가할 수 있습니다. 전화·문자는 발신·수신 캐릭터를 고르고 시작하며, 진행 중인 대화는 본 채팅으로 돌아와도 기록을 눌러 다시 열 수 있어요." theme={t}>
            <IconRow theme={t} items={[[<MessageSquare size={17} />, '나레이션'], [<MoreHorizontal size={17} />, '구분선'], [<Phone size={17} />, '전화·문자']]} />
          </GuideCard>
          <GuideCard title="공유 메모·장소·배경음·다른 방 초대" description="공유 메모와 장소·장면은 방 안에서 함께 관리합니다. 공유 배경음으로 같은 방의 배경음을 설정하고, ‘다른 방 초대’로 현재 역극에 다른 방을 연결할 수 있어요. 랜덤 도구 결과도 대화방에 공유할 수 있습니다." theme={t}>
            <IconRow theme={t} items={[[<MapPin size={17} />, '장소·장면'], [<Music size={17} />, '배경음'], [<DoorOpen size={17} />, '다른 방 초대']]} />
          </GuideCard>
        </Section>

        <Section title="5. 대화방 설정과 내보내기" theme={t}>
          <GuideCard title="초대·테마·읽음 표시" description="상단 설정에서 초대 코드를 복사하고, 방 테마와 읽음 표시 방식을 관리할 수 있어요. 각 참여자는 방장이 정한 공유 테마를 따르거나 자신의 테마를 사용할 수 있습니다. 공유 테마 변경은 방장만 할 수 있어요." theme={t}>
            <IconRow theme={t} items={[[<Copy size={17} />, '초대 코드'], [<Settings size={17} />, '방 설정'], [<Star size={17} />, '공유 테마']]} />
          </GuideCard>
          <GuideCard title="방장 설정과 대화 표시" description="방 설정에서 메시지 읽음 표시는 ‘읽음·숫자·없음’ 중 고를 수 있습니다. 방장은 입력 중 표시, 방 이름과 대표 이미지 같은 방 정보를 관리할 수 있어요. 메시지 시간과 ‘수정됨’ 표시는 전체 설정에서 켜고 끕니다." theme={t} />
          <GuideCard title="채팅 내보내기와 방 나가기" description="방 설정의 ‘채팅 내보내기’에서 대화 내용을 TXT 파일로 저장할 수 있습니다. 글자가 깨져 보이면 파일을 UTF-8 인코딩으로 열어보세요. 방에서 나가면 다시 들어올 때 초대 코드가 필요하며, 방장은 현재 방을 나갈 수 없습니다." theme={t}>
            <IconRow theme={t} items={[[<Download size={17} />, 'TXT 내보내기'], [<DoorOpen size={17} />, '방 나가기']]} />
          </GuideCard>
        </Section>

        <Section title="6. 앱 모양과 알림" theme={t}>
          <GuideCard title="새 디자인과 테마" description="전체 설정의 ‘새 디자인’ 토글은 방 목록·설정 등 앱 화면의 표현을 바꿉니다. 채팅방 화면은 기존 형태를 유지해요. 기본 색상 테마는 모노크롬이며, 내 테마를 바꾸면 모든 방에 적용됩니다. 방별 테마 설정은 별도로 선택할 수 있어요." theme={t} />
          <GuideCard title="글꼴·글자 크기·표시 옵션" description="전체 설정에서 글꼴과 채팅 글자 크기를 조정하고, 메시지 시간·수정됨 표시를 켜거나 끌 수 있습니다. 입장 룰렛 애니메이션은 개인 설정이에요." theme={t} />
          <GuideCard title="푸시 알림" description="전체 설정에서 새 메시지 푸시 알림을 켤 수 있습니다. 브라우저나 기기에서 IDEA 알림 권한을 허용해야 하며, 현재 브라우저가 푸시 알림을 지원하지 않으면 사용할 수 없어요." theme={t} />
        </Section>

        <Section title="문제가 생겼을 때" theme={t}>
          <GuideCard title="초대에 참여할 수 없어요" description="초대 코드가 맞는지 확인하고, 입장에 사용할 캐릭터를 선택했는지 확인해 주세요. 대화 중 화자가 필요하다면 해당 방에 캐릭터를 한 명 이상 추가해야 합니다." theme={t} />
          <GuideCard title="메시지나 설정이 반영되지 않아요" description="네트워크 연결을 확인하고 실패 상태인 메시지는 다시 보내세요. 설정 변경 후 오류 안내가 나타나면 저장되지 않았을 수 있으니 다시 시도해 주세요." theme={t}>
            <WifiOff size={18} color={t.subText} />
          </GuideCard>
          <GuideCard title="도움이 더 필요해요" description="앱 설정의 ‘앱 사용법’에서 이 페이지를 다시 열 수 있습니다. 어떤 화면에서 어떤 동작을 했는지와 표시된 오류 문구를 함께 확인하면 원인을 찾기 쉬워요." theme={t}>
            <CircleHelp size={18} color={t.point} />
          </GuideCard>
        </Section>
      </div>
    </div>
  )
}
