import { Box, Text } from 'ink'
// @ts-ignore
import React from 'react'
import { mutedColor } from '../config/colors.js'
import { BaseMessage, ImageMessage, Message } from '../config/types.js'
import { Image } from './index.js'

interface Props {
  messages: BaseMessage[]
}

function UserMessage({ message }: { message: Message }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={mutedColor}>{'>'}</Text>
        <Text color={mutedColor}>{message.content}</Text>
      </Box>
    </Box>
  )
}

function AIMessage({ message }: { message: Message }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text color="green">◆</Text>
          <Text>{message.content}</Text>
        </Box>
        {message.subcontent?.map(subcontent => (
          <Box key={subcontent} flexDirection="row" marginLeft={2} gap={1}>
            <Text color="green"> ↳</Text>
            <Text>{subcontent}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function ImageMessage({ message }: { message: ImageMessage }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Image src={message.imageBase64Buffer} alt="" />
    </Box>
  )
}

export default function MessageList({ messages }: Props) {
  const isUserMessage = (message: BaseMessage) =>
    message.isUser && 'content' in message
  const isImageMessage = (message: BaseMessage) =>
    'imageBase64Buffer' in message

  return (
    <Box flexDirection="column" paddingY={1} flexGrow={1}>
      {messages.map(message =>
        isUserMessage(message) ? (
          // @ts-ignore
          <UserMessage key={message.id} message={message} />
        ) : isImageMessage(message) ? (
          <ImageMessage key={message.id} message={message} />
        ) : (
          <AIMessage key={message.id} message={message} />
        )
      )}
    </Box>
  )
}
