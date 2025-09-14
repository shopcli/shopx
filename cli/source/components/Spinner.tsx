import { Text } from 'ink'
import React, { useEffect, useState } from 'react'

interface Props {
  color?: string
}

const SPINNER_CHARS = ['.', '+', '*', '◆']

export default function Spinner({ color = 'green' }: Props) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % SPINNER_CHARS.length)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return <Text color={color}>{SPINNER_CHARS[frame]}</Text>
}
