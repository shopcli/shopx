import { Box, Text } from 'ink'
import React from 'react'
import { mutedColor } from '../config/colors.js'
import { Message } from '../config/types.js'

interface Props {
  messages: Message[]
}

function UserMessage({ message }: { message: Message }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row">
        <Text color={mutedColor}>{'> '}</Text>
        <Text color={mutedColor}>{message.content}</Text>
      </Box>
    </Box>
  )
}

function AIMessage({ message }: { message: Message }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color="green">◆ </Text>
          <Text>{message.content}</Text>
        </Box>
        {message.subcontent?.map(subcontent => (
          <Box key={subcontent} flexDirection="row" marginLeft={2}>
            <Text color="green"> ↳ </Text>
            <Text>{subcontent}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default function MessageList({ messages }: Props) {
  return (
    <Box flexDirection="column" paddingY={1}>
      {messages.map(message =>
        message.isUser ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AIMessage key={message.id} message={message} />
        )
      )}
    </Box>
  )
}
