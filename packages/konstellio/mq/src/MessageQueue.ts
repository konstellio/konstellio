import { Disposable } from '@konstellio/disposable';
import { Pool } from '@konstellio/promised';

export type Serializable = string | number | boolean | Date;

export abstract class MessageQueue {
	abstract connect(): Promise<this>;
	abstract disconnect(): Promise<void>;

	abstract publish(name: string, payload: Payload): Promise<void>;
	abstract publish(name: string, topic: string, payload: Payload): Promise<void>;
	abstract subscribe(name: string, listener: SubscribListener): Promise<Disposable>;
	abstract subscribe(name: string, topic: string, listener: SubscribListener): Promise<Disposable>;

	subscribeIterator<T>(name: string): AsyncIteratorSubscription<T>;
	subscribeIterator<T>(name: string, topic: string): AsyncIteratorSubscription<T>;
	subscribeIterator<T>(name: string, topic?: string): AsyncIteratorSubscription<T> {
		return new AsyncIteratorSubscription<T>(this, name, topic);
	}

	abstract send(name: string, task: Payload): Promise<void>;
	abstract rpc(name: string, task: Payload, timeout: number): Promise<Message>;
	abstract consume(name: string, listener: ConsumeListener): Promise<Disposable>;
}

export interface Payload {
	[key: string]: any;
}

export interface Message {
	ts: number;
	[key: string]: any;
}

export type SubscribListener = (message: Message) => void;
export type ConsumeListener = (task: Message) => void | Message | Promise<Message>;

export class AsyncIteratorSubscription<T> implements AsyncIterator<T> {
	private disposed: boolean;

	protected messagePool: Pool<T>;
	protected subscription: Promise<Disposable>;

	constructor(protected mq: MessageQueue, protected name: string, protected topic?: string) {
		this.disposed = false;
		this.messagePool = new Pool();
		if (this.topic) {
			this.subscription = this.mq.subscribe(this.name, this.topic, msg => {
				this.messagePool.release(msg as any);
			});
		} else {
			this.subscription = this.mq.subscribe(this.name, msg => {
				this.messagePool.release(msg as any);
			});
		}
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	async dispose(): Promise<void> {
		if (!this.disposed) {
			const disposable = await this.subscription;
			disposable.dispose();
			this.disposed = true;
			(this as any).mq = undefined;
			(this as any).messagePool = undefined;
			(this as any).subscription = undefined;
		}
	}

	async next(): Promise<IteratorResult<T>> {
		if (this.disposed) {
			throw new Error(`This AsyncIteratorSubscription is disposed.`);
		}
		const msg = await this.messagePool.acquires();
		return { value: msg, done: false };
	}

	async return(): Promise<IteratorResult<T>> {
		if (this.disposed) {
			throw new Error(`This AsyncIteratorSubscription is disposed.`);
		}
		await this.dispose();
		return { value: undefined!, done: true };
	}

	async throw(error: Error): Promise<IteratorResult<T>> {
		await this.dispose();
		return Promise.reject(error);
	}

	[Symbol.asyncIterator](): AsyncIterator<T> {
		return this;
	}
}
