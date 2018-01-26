import { Disposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import { Driver, Queue, SubscribListener, Message } from '../Driver';

export class MemoryDriver extends Driver<MemoryQueue> {

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

	createQueue(name: string, topic?: string): Promise<MemoryQueue> {
		return Promise.resolve(new MemoryQueue(this, name, topic));
	}

}

export class MemoryQueue extends Queue<MemoryDriver> {
	protected emitter: EventEmitter

	constructor(
		protected readonly driver: Driver<MemoryQueue>,
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