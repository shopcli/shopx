import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import React, { useState } from 'react'

interface Props {
  onSubmit: (message: string) => void
  isTakingInput: boolean
}

export default function InputArea({ onSubmit, isTakingInput }: Props) {
  const [value, setValue] = useState('')

  const handleSubmit = (input: string) => {
    if (input.trim() && isTakingInput) {
      onSubmit(input.trim())
      setValue('')
    }
  }

  const handleChange = (input: string) => {
    if (isTakingInput) {
      setValue(input)
    }
  }

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
        flexDirection="row"
        gap={1}
        alignItems="center"
        minWidth={50}
      >
        <Box flexGrow={1} flexDirection="row" gap={1} alignItems="center">
          <Text color="green">{'> '}</Text>
          <TextInput
            value={value}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder={
              isTakingInput ? 'Type your message...' : 'Processing...'
            }
          />
        </Box>
      </Box>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Text color="gray">Press Enter to send</Text>
        <Text color="gray">{isTakingInput ? 'Ready' : 'Processing...'}</Text>
        <Text color="gray">Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  )
}
