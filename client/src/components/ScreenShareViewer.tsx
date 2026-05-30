import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'
import { useAppDispatch, useAppSelector } from '../hooks'
import { setFocusedScreenShare } from '../stores/ProximityShareStore'
import { sanitizeId } from '../util'
import Video from './Video'

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  flex-direction: column;
  padding: 16px 300px 16px 16px;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  color: #f8fafc;

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
`

const Stage = styled.div`
  flex: 1;
  border-radius: 12px;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
  }
`

const Placeholder = styled.p`
  margin: 0;
  color: #94a3b8;
  font-size: 15px;
  text-align: center;
  max-width: 420px;
  line-height: 1.5;
`

export default function ScreenShareViewer() {
  const dispatch = useAppDispatch()
  const focusedId = useAppSelector((state) => state.proximityShare.focusedSharerId)
  const peerStreams = useAppSelector((state) => state.proximityShare.peerStreams)
  const participants = useAppSelector((state) => state.participants.participants)
  const [timedOut, setTimedOut] = useState(false)

  const participant = focusedId ? participants.get(focusedId) : undefined

  useEffect(() => {
    if (focusedId && participant && !participant.screenSharing) {
      dispatch(setFocusedScreenShare(null))
    }
  }, [focusedId, participant?.screenSharing, dispatch])

  useEffect(() => {
    if (!focusedId) return

    setTimedOut(false)
    const game = phaserGame.scene.keys.game as Game | undefined
    game?.network.startWatchScreenShareRetry(focusedId)

    const timeout = window.setTimeout(() => setTimedOut(true), 12000)

    return () => {
      game?.network.stopWatchScreenShareRetry(focusedId)
      window.clearTimeout(timeout)
    }
  }, [focusedId])

  useEffect(() => {
    if (!focusedId) return
    const entry = peerStreams.get(sanitizeId(focusedId))
    if (entry?.stream) {
      setTimedOut(false)
      const game = phaserGame.scene.keys.game as Game | undefined
      game?.network.stopWatchScreenShareRetry(focusedId)
    }
  }, [focusedId, peerStreams])

  if (!focusedId) return null

  const entry = peerStreams.get(sanitizeId(focusedId))
  const name = participant?.name ?? entry?.ownerName ?? 'Guest'

  const close = () => {
    const game = phaserGame.scene.keys.game as Game | undefined
    game?.network.stopWatchScreenShareRetry(focusedId)
    dispatch(setFocusedScreenShare(null))
  }

  return (
    <Backdrop>
      <Header>
        <h2>{name}&apos;s screen</h2>
        <IconButton aria-label="Close screen share" onClick={close} sx={{ color: '#f8fafc' }}>
          <CloseIcon />
        </IconButton>
      </Header>
      <Stage>
        {entry?.stream ? (
          <Video srcObject={entry.stream} autoPlay />
        ) : (
          <Placeholder>
            {timedOut
              ? `Could not connect to ${name}'s screen. Ask them to press Share again, then retry from the member list.`
              : 'Connecting to screen share…'}
          </Placeholder>
        )}
      </Stage>
    </Backdrop>
  )
}
