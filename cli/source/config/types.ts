export interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  subcontent?: string[]
}

export interface CallbackMessage {
	sendMessage(message: Message, phase: string): Promise<void>;
	sendImage(imageBase64: string): void;
}
