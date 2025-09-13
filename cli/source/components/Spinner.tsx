import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import React from 'react'

interface Props {
  message?: string
  color?: string
}

export default function LoadingSpinner({
  message = 'Thinking...',
  color = 'green',
}: Props) {
  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={color}>
        <Spinner type="dots9" />
      </Text>
      <Text color={color}> {message}</Text>
    </Box>
  )
}
