import { Card, Skeleton } from './ui'

function LoadingLayout({ className, style, children }) {
  return (
    <div className={className} style={style} role="status" aria-label="불러오는 중" aria-busy="true">
      {children}
    </div>
  )
}

function IconPlaceholder({ className }) {
  return (
    <div className={className + ' screen-skeleton__icon'}>
      <Skeleton />
    </div>
  )
}

export function RoomListSkeleton() {
  return (
    <LoadingLayout className="room-list-page">
      <div className="room-list-shell">
        <div className="room-list-header">
          <div className="room-list-header__brand">
            <Skeleton className="room-list-header__logo screen-skeleton__brand" />
          </div>
          <IconPlaceholder className="room-list-primary-action" />
          <IconPlaceholder className="room-list-icon-action" />
          <IconPlaceholder className="room-list-icon-action" />
        </div>
        <div className="room-list-search">
          <Skeleton className="screen-skeleton__search" />
        </div>
        <div className="room-list-sort">
          <Skeleton className="room-list-sort__button" />
          <Skeleton className="room-list-sort__button" />
        </div>
        <div className="room-list-group-actions">
          <Skeleton className="screen-skeleton__group-action" />
        </div>
        <div className="room-list-groups">
          <div className="room-list-group">
            <div className="room-list-group__header">
              <Skeleton className="screen-skeleton__line" />
            </div>
            <div className="room-list-group__rooms">
              {[0, 1, 2, 3].map(index => (
                <div className="room-list-sortable" key={index}>
                  <Card className="room-list-card">
                    <Skeleton className="room-list-card__cover" />
                    <div className="room-list-card__content">
                      <Skeleton className="room-list-card__name screen-skeleton__line" />
                      <Skeleton className="room-list-card__preview screen-skeleton__line screen-skeleton__line--wide" />
                    </div>
                    <IconPlaceholder className="room-list-icon-button" />
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </LoadingLayout>
  )
}

const bubbleWidths = ['60%', '45%', '70%', '55%', '50%', '40%']

export function RoomSkeleton({ style }) {
  return (
    <LoadingLayout className="room-stage room-skeleton" style={style}>
      <div className="room-header">
        <div className="room-header__backdrop" aria-hidden="true" />
        <IconPlaceholder className="room-header__button" />
        <div className="room-header__title">
          <Skeleton className="screen-skeleton__line screen-skeleton__line--wide" />
        </div>
        <IconPlaceholder className="room-header__button" />
        <IconPlaceholder className="room-header__button" />
        <IconPlaceholder className="room-header__button" />
        <IconPlaceholder className="room-header__button" />
      </div>
      <div className="chat-scroll">
        {bubbleWidths.map((width, index) => (
          <div className={index % 2 ? 'message-row message-row--chat message-row--mine' : 'message-row message-row--chat'} key={width}>
            <div className="message-avatar-slot">
              <Skeleton className="message-avatar screen-skeleton__avatar" />
            </div>
            <div className="message-content" style={{ width }}>
              <Skeleton className="message-name screen-skeleton__line" />
              <Skeleton className="message-text-bubble screen-skeleton__bubble" />
            </div>
          </div>
        ))}
      </div>
      <div className="room-composer">
        <div className="room-composer__scrim" aria-hidden="true" />
        <div className="room-composer__row">
          <IconPlaceholder className="screen-skeleton__composer-icon" />
          <Skeleton className="screen-skeleton__composer-line" />
          <IconPlaceholder className="screen-skeleton__composer-icon" />
        </div>
      </div>
    </LoadingLayout>
  )
}

export function CharacterListSkeleton({ room = false }) {
  return (
    <LoadingLayout className="characters-page">
      <div className="character-shell">
        <div className={room ? 'character-header character-header--room' : 'character-header'}>
          <IconPlaceholder className="character-back" />
          <div className="character-grow">
            <Skeleton className="character-title screen-skeleton__line screen-skeleton__line--wide" />
            {room && <Skeleton className="character-room-name screen-skeleton__line" />}
          </div>
          {!room && <Skeleton className="screen-skeleton__small-action screen-skeleton__small-action--wide" />}
          <Skeleton className="screen-skeleton__small-action" />
        </div>
        <div className={room ? 'character-search character-search--room' : 'character-search'}>
          <Skeleton className="screen-skeleton__search" />
        </div>
        <Skeleton className="character-sort screen-skeleton__small-action screen-skeleton__sort" />
        {room && (
          <div className="character-section-label">
            <Skeleton className="screen-skeleton__line screen-skeleton__line--wide" />
          </div>
        )}
        <div className={room ? 'character-list character-list--selected' : 'character-list'}>
          {[0, 1, 2, 3].map(index => (
            <Card className={room ? 'character-list-item character-row--room' : 'character-list-item'} key={index}>
              <div className="character-row screen-skeleton__character-row">
                <IconPlaceholder className="character-drag" />
                {room && <IconPlaceholder className="character-selected-check" />}
                <Skeleton className={room ? 'character-avatar character-avatar--room' : 'character-avatar character-avatar--active screen-skeleton__avatar'} />
                <div className={room ? 'character-grow' : 'character-edit-link'}>
                  <Skeleton className="character-name screen-skeleton__line" />
                  {!room && <Skeleton className="character-description screen-skeleton__line screen-skeleton__line--wide" />}
                </div>
                <Skeleton className="character-effects screen-skeleton__small-action screen-skeleton__small-action--wide" />
                {!room && <IconPlaceholder className="character-delete" />}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </LoadingLayout>
  )
}
