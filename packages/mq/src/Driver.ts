import * as uuid from 'uuid/v4';
import { IDisposableAsync, IDisposable, Disposable } from '@konstellio/disposable';

export type Serializable = string | number | boolean | Date

export abstract class Driver<C extends Channel<any>, Q extends Queue<any>> {
	abstract connect(): Promise<this>
	abstract disconnect(): Promise<void>
	abstract createChannel(name: string, topic?: string): Promise<C>
	abstract createQueue(name: string): Promise<Q>
}

export type Message = {
	ts: number
	content: Buffer
}

export type SubscribListener = (message: Message) => void
export type ConsumeListener = (message: Message) => void | Buffer | Promise<Buffer>

export abstract class Channel<D extends Driver<any, any>> implements IDisposableAsync {
	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
	abstract publish(payload: Buffer): void
	abstract subscribe(listener: SubscribListener): Disposable
}

export abstract class Queue<D extends Driver<any, any>> implements IDisposableAsync {
	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
	abstract send(payload: Buffer): void
	abstract sendRPC(payload: Buffer): Promise<Message>
	abstract consume(listener: ConsumeListener): Disposable
}