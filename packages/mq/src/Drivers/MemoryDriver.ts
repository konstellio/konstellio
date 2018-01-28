import { Disposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import { Driver, Channel, Queue, SubscribListener, ConsumeListener, Message } from '../Driver';
import { setTimeout } from 'timers';

export class MemoryDriver extends Driver<MemoryChannel, MemoryQueue> {

	protected emitter: EventEmitter

	constructor() {
		super();

		this.emitter = new EventEmitter();
	}

	isDisposed(): boolean {
		return this.emitter.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.emitter.disposeAsync();
	}

	connect(): Promise<this> {
		return Promise.resolve(this);
	}

	disconnect(): Promise<void> {
		return Promise.resolve();
	}

	createChannel(name: string, topic?: string): Promise<MemoryChannel> {
		return Promise.resolve(new MemoryChannel(this, name, topic));
	}

	createQueue(name: string, topic?: string): Promise<MemoryQueue> {
		return Promise.resolve(new MemoryQueue(this, name, topic));
	}

}

export class MemoryChannel extends Channel<MemoryDriver> {
	protected emitter: EventEmitter

	constructor(
		protected readonly driver: MemoryDriver,
		public readonly name: string,
		public readonly topic = '*'
	) {
		super(driver, name, topic);

		this.emitter = new EventEmitter();
	}

	isDisposed(): boolean {
		return this.emitter.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.emitter.disposeAsync().then(() => {
			this.driver! = null!;
		});
	}

	publish(payload: Buffer): void {
		this.emitter.emit(`${this.name}.${this.topic}`, {
			ts: Date.now(),
			sender: this.driver.id,
			content: payload
		});
	}

	subscribe(listener: SubscribListener): Disposable {
		return this.emitter.on(`${this.name}.${this.topic}`, listener);
	}
}

export class MemoryQueue extends Queue<MemoryDriver> {
	protected emitter: EventEmitter

	constructor(
		protected readonly driver: MemoryDriver,
		public readonly name: string,
		public readonly topic = '*'
	) {
		super(driver, name, topic);

		this.emitter = new EventEmitter();
	}

	isDisposed(): boolean {
		return this.emitter.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.emitter.disposeAsync().then(() => {
			this.driver! = null!;
		});
	}

	send(payload: Buffer): void {
		return this.emitter.emit(`${this.name}.${this.topic}`, {
			ts: Date.now(),
			sender: this.driver.id,
			content: payload
		});
	}

	await(payload: Buffer): Promise<Message> {
		return this.emitter.emitAsync(`${this.name}.${this.topic}`, {
			ts: Date.now(),
			sender: this.driver.id,
			content: payload
		})
		.then((response: any) => {
			return {
				ts: Date.now(),
				sender: this.driver.id,
				content: response
			};
		});
	}

	consume(listener: ConsumeListener): Disposable {
		return this.emitter.on(
			`${this.name}.${this.topic}`,
			listener
		);
	}
}