import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, ChevronLeft, ChevronUp, CirclePlus, GripVertical, Image, LogIn, MessageSquare, MoreHorizontal, Paperclip, Phone, Quote, Search, Settings, Sparkles, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getTheme } from '../lib/themes'

const Section = ({ title, children, theme }) => (
  <section style={{ marginBottom: 26 }}>
    <h2 style={{ marginBottom: 10, color: theme.theirText, fontSize: 15 }}>{title}</h2>
    <div style={{ display: 'grid', gap: 10 }}>{children}</div>
  </section>
)

const GuideCard = ({ title, description, children, theme }) => (
  <div style={{ padding: 14, borderRadius: 13, border: `1px solid ${theme.border}`, background: theme.panel }}>
    <div style={{ color: theme.theirText, fontSize: 13, fontWeight: 500 }}>{title}</div>
    {description && <div style={{ marginTop: 5, color: theme.subText, fontSize: 11, lineHeight: 1.65 }}>{description}</div>}
    {children && <div style={{ marginTop: 12 }}>{children}</div>}
  </div>
)

const IconSample = ({ icon, label, theme, active = false }) => (
  <div style={{ display: 'grid', justifyItems: 'center', gap: 5 }}>
    <div style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 10, color: active ? theme.point : theme.subText, background: active ? `${theme.point}1f` : 'transparent' }}>{icon}</div>
    <span style={{ color: theme.subText, fontSize: 10 }}>{label}</span>
  </div>
)

export default function Help() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(getTheme('dark-purple'))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('theme_id').eq('id', user.id).maybeSingle()
      setTheme(getTheme(data?.theme_id || 'dark-purple'))
    })
  }, [])

  const t = theme

  return (
    <div className="settings-page-drawer" style={{ position: 'fixed', inset: 0, zIndex: 100, overflowY: 'auto', background: t.bg }}>
      <div style={{ width: '100%', maxWidth: 480, minHeight: '100dvh', margin: '0 auto', padding: '14px 16px 40px' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, margin: '-14px -16px 22px', padding: '12px 16px', background: `color-mix(in srgb, ${t.panel} 88%, transparent)`, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', border: 0, background: 'none', color: t.subText }}><ChevronLeft size={22} /></button>
          <div>
            <h1 style={{ color: t.theirText, fontSize: 16 }}>IDEA 사용법</h1>
            <div style={{ marginTop: 2, color: t.subText, fontSize: 10 }}>역극방을 만드는 순간부터 대화를 보관하는 방법까지</div>
          </div>
        </header>

        <Section title="1. 역극방 시작하기" theme={t}>
          <GuideCard title="새 방 만들기와 초대 코드 입장" description="메인 화면 상단의 아이콘으로 새 역극방을 만들거나 받은 초대 코드로 참여할 수 있습니다." theme={t}>
            <div style={{ display: 'flex', gap: 24 }}>
              <IconSample icon={<CirclePlus size={18} />} label="새 역극방" theme={t} />
              <IconSample icon={<LogIn size={18} />} label="초대 입장" theme={t} />
              <IconSample icon={<Search size={18} />} label="방 검색" theme={t} />
            </div>
          </GuideCard>
          <GuideCard title="방 정렬과 즐겨찾기" description="순서 변경 모드에서는 손잡이를 끌어 방 순서를 바꿀 수 있습니다. 별표를 누른 방은 목록 상단에 고정됩니다." theme={t}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 11, background: t.bg, border: `1px solid ${t.border}` }}>
              <GripVertical size={18} color={t.subText} />
              <span style={{ flex: 1, color: t.theirText, fontSize: 12 }}>이데아: 예시 역극방</span>
              <Star size={17} color={t.point} fill={t.point} />
            </div>
          </GuideCard>
        </Section>

        <Section title="2. 캐릭터와 프로필" theme={t}>
          <GuideCard title="방에서 사용할 캐릭터 고르기" description="전체 캐릭터 풀에서 방마다 사용할 캐릭터를 선택할 수 있습니다. 방별 순서는 실제 채팅 입력창의 프로필 순서에 반영됩니다." theme={t} />
          <GuideCard title="대화 중 프로필 변경" description="입력창 왼쪽 위의 화살표를 누르거나, 버튼을 누른 채 위로 밀면 목록이 열립니다. 아래로 밀면 닫힙니다." theme={t}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={{ padding: '4px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: `${t.panel}cc`, color: t.subText }}><ChevronUp size={14} /></button>
              <span style={{ color: t.subText, fontSize: 11 }}>클릭 또는 위로 스와이프</span>
            </div>
          </GuideCard>
        </Section>

        <Section title="3. 메시지 보내기" theme={t}>
          <GuideCard title="채팅 입력창" description="이미지를 첨부하고, 역극 편의기능을 열거나 메시지를 전송할 수 있습니다. 여러 줄을 입력해도 입력창 높이는 유지되며 내부에서 스크롤됩니다." theme={t}>
            <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 4, padding: 5, borderRadius: 22, border: `1px solid ${t.border}`, background: `${t.panel}cc` }}>
              <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: '50%', background: `${t.border}88`, color: t.subText }}><Paperclip size={15} /></span>
              <span style={{ flex: 1, color: t.subText, fontSize: 12 }}>메시지 입력…</span>
              <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: '50%', background: `${t.border}66`, color: t.subText }}><Sparkles size={15} /></span>
              <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: '50%', background: t.point, color: '#fff' }}><ArrowUp size={16} /></span>
            </div>
          </GuideCard>
          <GuideCard title="수정과 삭제" description="내 메시지를 길게 누르면 수정·삭제 메뉴가 열립니다. 메뉴 바깥을 누르면 닫힙니다." theme={t}>
            <div style={{ width: 'fit-content', marginLeft: 'auto' }}>
              <div style={{ padding: '8px 12px', borderRadius: 13, color: t.myText, background: t.myBubble, fontSize: 12 }}>수정할 메시지</div>
              <div style={{ display: 'flex', marginTop: 5, borderRadius: 9, overflow: 'hidden', border: `1px solid ${t.border}` }}>
                <span style={{ padding: '6px 12px', color: t.theirText, fontSize: 10 }}>수정</span>
                <span style={{ padding: '6px 12px', color: '#f87171', fontSize: 10, borderLeft: `1px solid ${t.border}` }}>삭제</span>
              </div>
            </div>
          </GuideCard>
        </Section>

        <Section title="4. 역극 편의기능" theme={t}>
          <GuideCard title="나레이션 · 구분선 · 전화/문자" description="입력창의 반짝임 아이콘을 누르면 역극 전용 메뉴가 열립니다." theme={t}>
            <div style={{ display: 'grid', gap: 7 }}>
              {[
                [<Quote size={15} />, '나레이션'],
                [<MoreHorizontal size={15} />, '문구가 있는 구분선'],
                [<Phone size={15} />, '전화 · 문자'],
              ].map(([icon, label]) => <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, border: `1px solid ${t.border}`, color: t.theirText, fontSize: 11 }}>{icon}{label}</div>)}
            </div>
          </GuideCard>
          <GuideCard title="전화와 문자" description="발신인과 수신인을 고른 뒤 연락합니다. 수신자는 전화는 받기·거절, 문자는 입장·나가기를 선택합니다. 본 채팅으로 잠시 돌아와도 진행 중 기록을 눌러 다시 들어갈 수 있습니다." theme={t}>
            <div style={{ display: 'flex', gap: 20 }}>
              <IconSample icon={<Phone size={18} />} label="음성 통화" theme={t} active />
              <IconSample icon={<MessageSquare size={18} />} label="문자 대화" theme={t} />
            </div>
          </GuideCard>
        </Section>

        <Section title="5. 검색과 설정" theme={t}>
          <GuideCard title="대화방 상단 메뉴" description="검색은 과거 대사를 찾고, 설정은 테마·읽음 표시·입력 중 표시·초대 코드·채팅 내보내기를 관리합니다." theme={t}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <IconSample icon={<Search size={18} />} label="검색" theme={t} />
              <IconSample icon={<Settings size={18} />} label="설정" theme={t} />
            </div>
          </GuideCard>
          <GuideCard title="전체 설정" description="메인 설정에서는 기본 테마와 글꼴, 채팅 글자 크기, 푸시 알림, 입장 애니메이션, 메시지 시간 표시를 변경할 수 있습니다." theme={t} />
        </Section>

        <Section title="6. 알아두면 좋은 기능" theme={t}>
          <GuideCard title="오프라인과 재전송" description="전송에 실패한 메시지는 실패 상태로 표시됩니다. 네트워크가 복구되면 다시 전송하거나 직접 재시도할 수 있습니다." theme={t} />
          <GuideCard title="읽지 않은 위치와 날짜 구분선" description="다시 입장하면 읽지 않은 메시지 위치가 표시되고, 날짜가 달라지는 지점에는 날짜 구분선이 나타납니다." theme={t} />
          <GuideCard title="이미지와 내보내기" description="이미지는 여러 장을 한 번에 전송할 수 있습니다. 대화방 설정의 채팅 내보내기로 전체 기록을 텍스트 파일로 보관할 수 있습니다." theme={t}>
            <Image size={18} color={t.subText} />
          </GuideCard>
        </Section>
      </div>
    </div>
  )
}
