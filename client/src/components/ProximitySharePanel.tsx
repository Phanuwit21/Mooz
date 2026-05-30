import React from 'react'
import styled from 'styled-components'
import { useAppSelector } from '../hooks'
import Video from './Video'

const Panel = styled.div`
  position: fixed;
  top: 72px;
  right: 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 820;
  max-width: 280px;
`

const Card = styled.div`
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  overflow: hidden;

  p {
    margin: 0;
    padding: 6px 8px;
    font-size: 12px;
    color: #e2e8f0;
    background: rgba(0, 0, 0, 0.5);
  }

  video {
    width: 260px;
    height: 146px;
    display: block;
    object-fit: contain;
    background: #000;
  }
`

export default function ProximitySharePanel() {
  const peerStreams = useAppSelector((state) => state.proximityShare.peerStreams)
  const myStream = useAppSelector((state) => state.proximityShare.myStream)

  const entries = [...peerStreams.entries()]
  if (entries.length === 0 && !myStream) return null

  return (
    <Panel>
      {myStream && (
        <Card>
          <p>Your screen (sharing)</p>
          <Video srcObject={myStream} autoPlay muted />
        </Card>
      )}
      {entries.map(([id, { stream, ownerName }]) => (
        <Card key={id}>
          <p>{ownerName} is sharing</p>
          <Video srcObject={stream} autoPlay />
        </Card>
      ))}
    </Panel>
  )
}
