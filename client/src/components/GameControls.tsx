import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import PanToolIcon from '@mui/icons-material/PanTool'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant'
import GroupsIcon from '@mui/icons-material/Groups'
import BorderColorIcon from '@mui/icons-material/BorderColor'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

const Bar = styled.div`
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  z-index: 850;
  pointer-events: auto;
`

const Btn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: #f8fafc;
  background: ${(p) => (p.$active ? 'rgba(91, 155, 213, 0.45)' : 'rgba(51, 65, 85, 0.9)')};

  &:hover {
    background: rgba(71, 85, 105, 0.95);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`

export default function GameControls() {
  const [handRaised, setHandRaised] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [inMeeting, setInMeeting] = useState(false)
  const [hasDesks, setHasDesks] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      const game = phaserGame.scene.keys.game as Game | undefined
      if (!game?.myPlayer) return
      setHandRaised(game.myPlayer.handRaised)
      setSharing(game.myPlayer.screenSharing)
      setInMeeting(game.myPlayer.inMeeting)
      setHasDesks(game.hasDesks())
    }, 200)
    return () => clearInterval(id)
  }, [])

  const game = phaserGame.scene.keys.game as Game | undefined

  return (
    <Bar>
      <Btn $active={handRaised} onClick={() => game?.toggleHandRaised()} title="Raise hand">
        <PanToolIcon fontSize="small" />
        Hand
      </Btn>

      <Btn
        $active={sharing}
        onClick={() => game?.toggleProximityScreenShare()}
        title="Share screen nearby"
      >
        <ScreenShareIcon fontSize="small" />
        Share
      </Btn>

      <Btn $active={inMeeting} onClick={() => game?.toggleMeetingMode()} title="Meeting mode">
        <GroupsIcon fontSize="small" />
        Meet
      </Btn>

      <Btn onClick={() => game?.openNearbyWhiteboard()} title="Open whiteboard">
        <BorderColorIcon fontSize="small" />
        Board
      </Btn>

      {hasDesks && (
        <Btn onClick={() => game?.claimDeskAtPlayer()} title="Claim desk under you">
          <TableRestaurantIcon fontSize="small" />
          Desk
        </Btn>
      )}
    </Bar>
  )
}
