export interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  subcontent?: string[]
}

export interface ImageMessage {
  id: string
  imageBase64Buffer: Buffer
  isUser: boolean
  timestamp: Date
}

export type BaseMessage = Message | ImageMessage

export interface CallbackMessage {
	sendMessage(message: string, subcontent?: string[]): Promise<void>;
	sendImage(imageBase64: string): void;
	sendOptions(options: string[]): Promise<string>;
}
