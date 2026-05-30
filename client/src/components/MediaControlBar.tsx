import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'

import { useAppSelector } from '../hooks'
import phaserGame from '../PhaserGame'
import Bootstrap from '../scenes/Bootstrap'

const Bar = styled.div`
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  gap: 8px;
  z-index: 920;
  pointer-events: auto;
`

const MediaBtn = styled.button<{ $off?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  color: #f8fafc;
  background: ${(p) =>
    p.$off ? 'rgba(220, 38, 38, 0.88)' : 'rgba(30, 41, 59, 0.94)'};
  border: 2px solid ${(p) => (p.$off ? 'rgba(248, 113, 113, 0.9)' : 'rgba(255, 255, 255, 0.12)')};
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);

  &:hover {
    filter: brightness(1.08);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`

function getWebRTC() {
  const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap | undefined
  return bootstrap?.network?.webRTC
}

export default function MediaControlBar() {
  const videoConnected = useAppSelector((state) => state.user.videoConnected)
  const [audioOn, setAudioOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)

  const syncFromStream = useCallback(() => {
    const rtc = getWebRTC()
    if (!rtc) return
    setAudioOn(rtc.isAudioEnabled())
    setVideoOn(rtc.isVideoEnabled())
  }, [])

  useEffect(() => {
    if (!videoConnected) return
    syncFromStream()
    const id = window.setInterval(syncFromStream, 400)
    return () => clearInterval(id)
  }, [videoConnected, syncFromStream])

  if (!videoConnected) return null

  const rtc = getWebRTC()

  return (
    <Bar>
      <MediaBtn
        type="button"
        $off={!audioOn}
        disabled={!rtc}
        title={audioOn ? 'ปิดไมค์' : 'เปิดไมค์'}
        aria-label={audioOn ? 'Microphone on' : 'Microphone off'}
        onClick={() => {
          rtc?.toggleAudio()
          syncFromStream()
        }}
      >
        {audioOn ? <MicIcon /> : <MicOffIcon />}
      </MediaBtn>
      <MediaBtn
        type="button"
        $off={!videoOn}
        disabled={!rtc}
        title={videoOn ? 'ปิดกล้อง' : 'เปิดกล้อง'}
        aria-label={videoOn ? 'Camera on' : 'Camera off'}
        onClick={() => {
          rtc?.toggleVideo()
          syncFromStream()
        }}
      >
        {videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
      </MediaBtn>
    </Bar>
  )
}
