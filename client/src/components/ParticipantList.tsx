import React, { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import SearchIcon from '@mui/icons-material/Search'
import PeopleIcon from '@mui/icons-material/People'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import ChatIcon from '@mui/icons-material/Chat'
import SlideshowIcon from '@mui/icons-material/Slideshow'

import { useAppDispatch, useAppSelector } from '../hooks'
import { displayAreaName, Participant } from '../stores/ParticipantStore'
import { setChatTarget, setShowChat } from '../stores/ChatStore'
import { setFocusedScreenShare } from '../stores/ProximityShareStore'
import { PlayerPresence } from '../../../types/PlayerPresence'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

const Sidebar = styled.aside`
  position: fixed;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  background: rgba(15, 23, 42, 0.94);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  z-index: 800;
  backdrop-filter: blur(8px);
`

const Header = styled.div`
  padding: 16px 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  h2 {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  p {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
  }
`

const SearchBox = styled.div`
  margin: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.06);

  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: #e2e8f0;
    font-size: 13px;

    &::placeholder {
      color: #64748b;
    }
  }

  svg {
    font-size: 18px;
    color: #64748b;
  }
`

const Scroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
`

const AreaSection = styled.section`
  margin-bottom: 16px;
`

const AreaTitle = styled.h3`
  margin: 0 0 6px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
`

const Row = styled.div<{ $isSelf?: boolean; $following?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;

  ${(p) =>
    p.$isSelf &&
    `
    background: rgba(91, 155, 213, 0.15);
  `}

  ${(p) =>
    p.$following &&
    `
    background: rgba(91, 155, 213, 0.22);
  `}

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`

const NameButton = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;

  &:disabled {
    cursor: default;
  }
`

const RowActions = styled.div`
  display: flex;
  gap: 2px;
  flex-shrink: 0;
`

const ActionBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: ${(p) => (p.$active ? 'rgba(91, 155, 213, 0.45)' : 'transparent')};
  color: #94a3b8;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
  }
`

const StatusDot = styled.span<{ $presence: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => (p.$presence === PlayerPresence.AFK ? '#eab308' : '#22c55e')};
`

const Name = styled.span`
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

function groupByArea(participants: Participant[]) {
  const groups = new Map<string, { areaId: string; areaName: string; members: Participant[] }>()

  for (const p of participants) {
    const key = p.areaId || '__open__'
    const label = displayAreaName(p.areaId, p.areaName)
    if (!groups.has(key)) {
      groups.set(key, { areaId: p.areaId, areaName: label, members: [] })
    }
    groups.get(key)!.members.push(p)
  }

  const sorted = [...groups.values()]
  sorted.sort((a, b) => {
    if (!a.areaId) return 1
    if (!b.areaId) return -1
    return a.areaName.localeCompare(b.areaName)
  })

  for (const g of sorted) {
    g.members.sort((a, b) => a.name.localeCompare(b.name))
  }

  return sorted
}

export default function ParticipantList() {
  const [query, setQuery] = useState('')
  const [followTargetId, setFollowTargetId] = useState<string | null>(null)
  const dispatch = useAppDispatch()
  const sessionId = useAppSelector((state) => state.user.sessionId)
  const participantsMap = useAppSelector((state) => state.participants.participants)

  useEffect(() => {
    const id = window.setInterval(() => {
      const game = phaserGame.scene.keys.game as Game | undefined
      setFollowTargetId(game?.getFollowTargetId() ?? null)
    }, 200)
    return () => clearInterval(id)
  }, [])

  const participants = useMemo(() => {
    const list = [...participantsMap.values()].filter((p) => p.name)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((p) => p.name.toLowerCase().includes(q))
  }, [participantsMap, query])

  const groups = useMemo(() => groupByArea(participants), [participants])
  const totalCount = participants.length

  return (
    <Sidebar>
      <Header>
        <h2>
          <PeopleIcon fontSize="small" />
          Everyone
        </h2>
        <p>{totalCount} in room</p>
      </Header>

      <SearchBox>
        <SearchIcon />
        <input
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </SearchBox>

      <Scroll>
        {groups.length === 0 && (
          <AreaTitle style={{ textTransform: 'none', fontSize: 13 }}>No one here yet</AreaTitle>
        )}
        {groups.map((group) => (
          <AreaSection key={group.areaId || '__open__'}>
            <AreaTitle>
              {group.areaName} · {group.members.length}
            </AreaTitle>
            {group.members.map((p) => {
              const isSelf = p.id === sessionId
              const following = followTargetId === p.id
              const game = phaserGame.scene.keys.game as Game | undefined

              return (
                <Row key={p.id} $isSelf={isSelf} $following={following}>
                  <NameButton
                    type="button"
                    disabled={isSelf}
                    onClick={() => game?.setFollowTarget(p.id)}
                    title={isSelf ? undefined : following ? 'Stop following' : `Follow ${p.name}`}
                  >
                    <StatusDot $presence={p.presence} />
                    <Name>
                      {p.handRaised ? '✋ ' : ''}
                      {p.name}
                      {isSelf ? ' (you)' : ''}
                      {following ? ' · following' : ''}
                      {p.inMeeting ? ' 🎙' : ''}
                    </Name>
                  </NameButton>
                  {!isSelf && (
                    <RowActions>
                      {p.screenSharing && (
                        <ActionBtn
                          type="button"
                          title={`Watch ${p.name}'s screen`}
                          onClick={() => {
                            dispatch(setFocusedScreenShare(p.id))
                          }}
                        >
                          <SlideshowIcon sx={{ fontSize: 18, color: '#38bdf8' }} />
                        </ActionBtn>
                      )}
                      <ActionBtn
                        type="button"
                        $active={following}
                        title={following ? 'Stop following' : `Follow ${p.name}`}
                        onClick={() => game?.setFollowTarget(p.id)}
                      >
                        <MyLocationIcon sx={{ fontSize: 18 }} />
                      </ActionBtn>
                      <ActionBtn
                        type="button"
                        title={`Message ${p.name}`}
                        onClick={() => {
                          dispatch(setChatTarget(p.id))
                          dispatch(setShowChat(true))
                        }}
                      >
                        <ChatIcon sx={{ fontSize: 18 }} />
                      </ActionBtn>
                    </RowActions>
                  )}
                </Row>
              )
            })}
          </AreaSection>
        ))}
      </Scroll>
    </Sidebar>
  )
}
