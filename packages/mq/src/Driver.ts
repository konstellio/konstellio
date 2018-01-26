import * as uuid from 'uuid/v4';
import { IDisposableAsync, IDisposable, Disposable } from '@konstellio/disposable';

export type Serializable = string | number | boolean | Date

export abstract class Driver<Q extends Queue<any>> {

	public readonly id: string

	constructor()  {
		this.id = uuid();
	}

	abstract connect(): Promise<this>
	abstract disconnect(): Promise<void>
	abstract createQueue(name: string, topic?: string): Promise<Q>
}

export type Message = {
	ts: number
	sender: string
	content: Buffer
}

export type SubscribListener = (message: Message) => void

export abstract class Queue<D extends Driver<any>> implements IDisposableAsync {

	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>

	public constructor(
		protected readonly driver: Driver<any>,
		public readonly name: string,
		public readonly topic = ''
	) {
		
	}

	abstract publish(payload: Buffer): void
	abstract subscribe(listener: SubscribListener): Disposable
}