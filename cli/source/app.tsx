import { Box } from 'ink'
import React, { useState } from 'react'
import {
  FlavourText,
  Header,
  InputArea,
  MessageList,
} from './components/index.js'
import { CallbackMessage, Message } from './config/types.js'
import { callShopapp } from '../../tools/shopapp/agent.js';
import {speak} from '../../eleven-labs-boilerplate/example.mjs';

class AppClass implements CallbackMessage {
	constructor(
		public notify: (arg0: string) => Promise<void>,
		public notifyImage: (arg0: string) => void,
		public notifyOptions: (arg0: string[]) => Promise<void>,
	) {
		this.notify = notify;
		this.notifyImage = notifyImage;
	}
	async sendMessage(message: string): Promise<void> {
		await this.notify(message);
	}

	sendImage(imageBase64: string) {
		this.notifyImage(imageBase64);
	}

	async sendOptions(options: string[]): Promise<void> {
		await this.notifyOptions(options);
	}
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

	// @ts-ignore
	const handleMessageResponse = async (message: string) => {
		setMessages(prev => [...prev, { id: Date.now().toString(),
			content: message,
			isUser: false,
			timestamp: new Date(),}])
		await speak(message)
	}

	// @ts-ignore
	const handleImageResponse = (imageBase64: string) => {
		setMessages(prev => [...prev, { id: Date.now().toString(),
			content: "yippee",
			isUser: false,
			timestamp: new Date(),}]);
		setIsProcessing(false)
	}

	// @ts-ignore
	const handleOptionsResponse = async (options: string[]) => {
		setMessages(prev => [...prev, { id: Date.now().toString(),
			content: JSON.stringify(options),
			isUser: false,
			timestamp: new Date(),}]);
		return; // FIXME: actually prompt for input
	}

	const app = new AppClass(handleMessageResponse, handleImageResponse, handleOptionsResponse)

  const handleMessageSubmit = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsProcessing(true)

    await callShopapp(userMessage, app)
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
