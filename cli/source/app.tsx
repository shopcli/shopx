import { Box } from 'ink'
import React, { useState } from 'react'
import {
  FlavourText,
  Header,
  InputArea,
  MessageList,
} from './components/index.js'
import { Message } from './config/types.js'

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const handleMessageSubmit = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsProcessing(true)

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I received your message: "${content}". This is a simulated response.`,
        isUser: false,
        timestamp: new Date(),
        subcontent: ['This is a simulated response.'],
      }
      setMessages(prev => [...prev, aiMessage])
      setIsProcessing(false)
    }, 1000)
  }

  return (
    <Box flexDirection="column" padding={1} flexGrow={1} height={'100%'}>
      <Box flexDirection="column">
        <Header />
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingY={1}>
        <MessageList messages={messages} />
      </Box>

      <Box>{isProcessing && <FlavourText />}</Box>

      <Box flexDirection="column">
        <InputArea onSubmit={handleMessageSubmit} isProcessing={isProcessing} />
      </Box>
    </Box>
  )
}
