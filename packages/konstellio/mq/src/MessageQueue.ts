import { Disposable, IDisposableAsync } from '@konstellio/disposable';
import { Pool } from '@konstellio/promised';

export type Serializable = string | number | boolean | Date;

export abstract class MessageQueue {
	abstract connect(): Promise<this>;
	abstract disconnect(): Promise<void>;
	
	abstract publish(name: string, payload: Payload): Promise<void>;
	abstract publish(name: string, topic: string, payload: Payload): Promise<void>;
	abstract subscribe(name: string, listener: SubscribListener): Promise<Disposable>;
	abstract subscribe(name: string, topic: string, listener: SubscribListener): Promise<Disposable>;

	async *subscribeIterator(name: string): AsyncIterator<Message> {
		return new AsyncIteratorSubscription(this, name);
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

export class AsyncIteratorSubscription implements AsyncIterator<Message>, IDisposableAsync {
	private disposed: boolean;

	protected messagePool: Pool<Message>;
	protected subscription: Promise<Disposable>;

	constructor(
		protected mq: MessageQueue,
		protected name: string
	) {
		this.disposed = false;
		this.messagePool = new Pool<Message>();
		this.subscription = this.mq.subscribe(this.name, (msg) => {
			this.messagePool.release(msg);
		});
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	async disposeAsync(): Promise<void> {
		const disposable = await this.subscription;
		disposable.dispose();
		this.disposed = true;
	}

	async next(): Promise<IteratorResult<Message>> {
		const msg = await this.messagePool.acquires();
		return { value: msg, done: false };
	}

	async return(): Promise<IteratorResult<Message>> {
		await this.disposeAsync();
		return { value: undefined!, done: true };
	}

	async throw(error: Error): Promise<IteratorResult<Message>> {
		await this.disposeAsync();
		return Promise.reject(error);
	}

	[Symbol.asyncIterator]() {
		return this;
	}
}