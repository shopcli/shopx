import { Box } from 'ink'
import React, { useState } from 'react'
import {
  FlavourText,
  Header,
  InputArea,
  MessageList,
} from './components/index.js'
import { CallbackMessage, Message } from './config/types.js'

class AppClass implements CallbackMessage {
	constructor(
		public notify: (arg0: Message, arg1: string) => void,
		public notifyImage: (arg0: string) => void,
	) {
		this.notify = notify;
		this.notifyImage = notifyImage;
	}
	async sendMessage(message: Message, phase: string): Promise<void> {
		this.notify(message, phase);
	}

	sendImage(imageBase64: string) {
		this.notifyImage(imageBase64);
	}
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

	const handleMessageResponse = async (message: Message, phase: string) => {

	}

	const handleImageResponse = (imageBase64: string) => {

	}

	const app = new AppClass(handleMessageResponse, handleImageResponse)

  const handleMessageSubmit = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsProcessing(true)

    callShopapp(userMessage, app)
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
