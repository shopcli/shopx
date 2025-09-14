import { Box } from 'ink'
import React, { useState } from 'react'
import { callShopapp } from '../../tools/shopapp/agent.js'
import {
  FlavourText,
  Header,
  InputArea,
  MessageList,
} from './components/index.js'
import { BaseMessage, CallbackMessage, Message } from './config/types.js'

class AppClass implements CallbackMessage {
  constructor(
    public notify: (arg0: string, arg1?: string[]) => Promise<void>,
    public notifyImage: (arg0: string) => void,
    public notifyOptions: (arg0: string[]) => Promise<string>
  ) {
    this.notify = notify
    this.notifyImage = notifyImage
  }
  async sendMessage(message: string, subcontent?: string[]): Promise<void> {
    await this.notify(message, subcontent)
  }

  sendImage(imageBase64: string) {
    this.notifyImage(imageBase64)
  }

  async sendOptions(options: string[]): Promise<string> {
    return await this.notifyOptions(options)
  }
}

export default function App() {
  const [messages, setMessages] = useState<BaseMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTakingInput, setIsTakingInput] = useState(true)
  const [isRespondingToOptions, setIsRespondingToOptions] = useState(false)
  const [pendingOptionsResolve, setPendingOptionsResolve] = useState<
    ((value: string) => void) | null
  >(null)

  // @ts-ignore
  const handleMessageResponse = async (
    message: string,
    subcontent?: string[]
  ) => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        content: message,
        isUser: false,
        timestamp: new Date(),
        subcontent,
      },
    ])
  }

  // @ts-ignore
  const handleImageResponse = (imageBase64: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        imageBase64Buffer: Buffer.from(imageBase64, 'base64'),
        isUser: false,
        timestamp: new Date(),
      },
    ])
    setIsProcessing(false)
    setIsTakingInput(true)
  }

  // @ts-ignore
  const handleOptionsResponse = async (options: string[]) => {
    setIsProcessing(false)
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        content: `Please select an option from the following list:`,
        isUser: false,
        timestamp: new Date(),
        subcontent: options.map((opt, i) => `${i + 1}. ${opt}`),
      },
    ])

    setIsTakingInput(true)
    setIsRespondingToOptions(true)

    // Return a Promise that resolves when user makes a selection
    return new Promise<string>(resolve => {
      setPendingOptionsResolve(() => resolve)
    })
  }

  const app = new AppClass(
    handleMessageResponse,
    handleImageResponse,
    handleOptionsResponse
  )

  const handleMessageSubmit = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])

    if (isRespondingToOptions && pendingOptionsResolve) {
      // User is responding to options - resolve the promise with their selection
      setIsTakingInput(false)
      setIsProcessing(true)
      setIsRespondingToOptions(false)
      // @ts-ignore
      pendingOptionsResolve(content)
      setPendingOptionsResolve(null)
      return
    }

    if (userMessage.content.toLowerCase() === '/help') {
      const helpMessage = {
        id: Date.now().toString() + 'help',
        content: 'Here are some tips for getting started:',
        isUser: false,
        timestamp: new Date(),
        subcontent: [
          'Type what you need in plain english - "anniversary flowers" or "forgot my friends\'s birthday, help"',
          'shopx finds and shows you options - searches e-commerce sites and presents relevant products',
          "shop discreetly from your command line - looks like you're running development commands, not shopping",
        ],
      }
      setMessages(prev => [...prev, helpMessage])
      return
    } else if (
      userMessage.content.toLowerCase() === '/clear' ||
      userMessage.content.toLowerCase() === '/c'
    ) {
      setMessages([])
      return
    }

    setIsProcessing(true)
    setIsTakingInput(false)

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
        <InputArea
          onSubmit={handleMessageSubmit}
          isTakingInput={isTakingInput}
        />
      </Box>
    </Box>
  )
}
