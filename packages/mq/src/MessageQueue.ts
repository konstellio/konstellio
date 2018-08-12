import { Disposable } from '@konstellio/disposable';

export type Serializable = string | number | boolean | Date

export abstract class MessageQueue {
	abstract connect(): Promise<this>
	abstract disconnect(): Promise<void>
	
	abstract publish(name: string, payload: Payload): Promise<void>
	abstract publish(name: string, topic: string, payload: Payload): Promise<void>
	abstract subscribe(name: string, listener: SubscribListener): Promise<Disposable>
	abstract subscribe(name: string, topic: string, listener: SubscribListener): Promise<Disposable>

	abstract send(name: string, task: Payload): Promise<void>
	abstract rpc(name: string, task: Payload, timeout: number): Promise<Message>
	abstract consume(name: string, listener: ConsumeListener): Promise<Disposable>
}

export interface Payload {
	[key: string]: any
}

export interface Message {
	ts: number
	[key: string]: any
}

export type SubscribListener = (message: Message) => void
export type ConsumeListener = (task: Message) => void | Message | Promise<Message>