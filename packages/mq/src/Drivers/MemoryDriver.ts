import { Disposable, CompositeDisposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import * as uuid from 'uuid/v4';
import { Driver, Channel, Queue, SubscribListener, ConsumeListener, Message } from '../Driver';
import { clearTimeout } from 'timers';

function getHiddenMember<T>(target: Object, member: string): T {
	return target[member] as T;
}

export class MemoryDriver extends Driver<MemoryChannel, MemoryQueue> {

	constructor() {
		super();
	}

	async connect(): Promise<this> {
		return this;
	}

	async disconnect(): Promise<void> {
		return;
	}

	async createChannel(name: string, topic = ''): Promise<MemoryChannel> {
		return new MemoryChannel(this, name, topic);
	}

	async createQueue(name: string): Promise<MemoryQueue> {
		return new MemoryQueue(this, name);
	}
}

export class MemoryChannel extends Channel<MemoryDriver> {

	protected emitter: EventEmitter
	protected disposable: CompositeDisposable

	public constructor(
		protected readonly driver: MemoryDriver,
		protected readonly name: string,
		protected readonly topic: string
	) {
		super();
		this.emitter = new EventEmitter();
		this.disposable = new CompositeDisposable();
		this.disposable.add(new Disposable(() => this.emitter.dispose()));
	}

	isDisposed(): boolean {
		return this.disposable.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.disposable.disposeAsync();
	}

	publish(payload: Buffer): void {
		this.emitter.emit(`subscribe`, payload);
	}

	subscribe(listener: SubscribListener): Disposable {
		return this.emitter.on(`subscribe`, listener);
	}
}

export class MemoryQueue extends Queue<MemoryDriver> {

	protected disposable: CompositeDisposable
	protected consumers: ConsumeListener[]
	protected nextConsumer: number

	public constructor(
		protected readonly driver: MemoryDriver,
		protected readonly name: string
	) {
		super();
		this.disposable = new CompositeDisposable();
		this.consumers = [];
		this.nextConsumer = -1;
	}

	isDisposed(): boolean {
		return this.disposable.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.disposable.disposeAsync();
	}

	send(payload: Buffer): void {
		const idx = (++this.nextConsumer) % this.consumers.length;
		try {
			this.consumers[idx]({
				ts: Date.now(),
				content: payload
			});
		} catch (err) {
			setTimeout(() => this.send(payload), 1000);
		}
	}

	sendRPC(payload: Buffer, timeout = 2000): Promise<Message> {
		return new Promise(async (resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error(`RPC timeout (${timeout}ms).`));
			}, timeout);

			const idx = (++this.nextConsumer) % this.consumers.length;
			try {
				const result = await this.consumers[idx]({
					ts: Date.now(),
					content: payload
				});
				clearTimeout(timer);
				resolve({
					ts: Date.now(),
					content: result ? result : Buffer.from('')
				});
			} catch (err) {
				clearTimeout(timer);
				reject(err);
			}
		});
	}

	consume(listener: ConsumeListener): Disposable {
		const disposable = new Disposable(() => {
			const idx = this.consumers.indexOf(listener);
			if (idx > -1) {
				this.consumers.splice(idx, 1);
			}
		});
		this.consumers.push(listener);
		return disposable;
	}
}