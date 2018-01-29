import { Disposable, CompositeDisposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import * as uuid from 'uuid/v4';
import { ClientOpts, RedisClient } from 'redis';
import { Driver, Channel, Queue, SubscribListener, ConsumeListener, Message } from '../Driver';

let createClient: () => RedisClient;
try { createClient = require('redis-mock').createClient; } catch(e) { }

export class RedisMockDriver extends Driver<RedisMockChannel, RedisMockQueue> {

	protected subscriber: RedisClient
	protected publisher: RedisClient
	protected emitter: EventEmitter

	constructor() {
		super();

		this.subscriber = createClient();
		this.publisher = createClient();
		this.emitter = new EventEmitter();

		this.subscriber.on('message', (channel, payload) => {
			try {
				const json = JSON.parse(payload);
				json.content = typeof json.content === 'string' ? Buffer.from(json.content) : Buffer.from('');
				this.emitter.emit(channel, json);
			}
			catch (e) {
				// :'(
			}
		});
	}

	isDisposed(): boolean {
		return this.emitter.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return new Promise((resolve, reject) => {
			// this.subscriber.unsubscribe();
			this.subscriber.quit(); // No callback in redis-mock
			this.subscriber! = undefined!;
			this.publisher.quit(); // No callback in redis-mock
			this.publisher! = undefined!;
			resolve();
		});
	}

	connect(): Promise<this> {
		return Promise.resolve(this);
	}

	disconnect(): Promise<void> {
		return this.disposeAsync();
	}

	createChannel(name: string, topic?: string): Promise<RedisMockChannel> {
		return Promise.resolve(new RedisMockChannel(this, name, topic));
	}

	createQueue(name: string): Promise<RedisMockQueue> {
		return Promise.resolve(new RedisMockQueue(this, name));
	}
}

export class RedisMockChannel extends Channel<RedisMockDriver> {

	protected disposable: CompositeDisposable

	public constructor(
		protected readonly driver: RedisMockDriver,
		public readonly name: string,
		public readonly topic = ''
	) {
		super();
		this.disposable = new CompositeDisposable();
		((this.driver as any).subscriber as RedisClient).subscribe(
			`pub.${this.name}.${this.topic}`
		);
	}

	isDisposed(): boolean {
		return this.disposable.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.disposable.disposeAsync().then(() => new Promise((resolve, reject) => {
			((this.driver as any).subscriber as RedisClient).unsubscribe(
				`pub.${this.name}.${this.topic}`
			);
		})).then(() => {});
	}

	publish(payload: Buffer): void {
		((this.driver as any).publisher as RedisClient).publish(
			`pub.${this.name}.${this.topic}`,
			JSON.stringify({
				ts: Date.now(),
				content: payload.toString()
			})
		)
	}

	subscribe(listener: SubscribListener): Disposable {
		const event = ((this.driver as any).emitter as EventEmitter).on(
			`pub.${this.name}.${this.topic}`,
			listener
		);

		this.disposable.add(event);

		return event;
	}

}

export class RedisMockQueue extends Queue<RedisMockDriver> {

	protected disposable: CompositeDisposable

	public constructor(
		protected readonly driver: Driver<any, any>,
		public readonly name: string
	) {
		super();
		this.disposable = new CompositeDisposable();
		((this.driver as any).subscriber as RedisClient).subscribe(
			`wkr.${this.name}`
		);
	}

	isDisposed(): boolean {
		return this.disposable.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.disposable.disposeAsync().then(() => new Promise((resolve, reject) => {
			((this.driver as any).subscriber as RedisClient).unsubscribe(
				`wkr.${this.name}`
			);
		})).then(() => { });
	}

	send(payload: Buffer): void {
		((this.driver as any).publisher as RedisClient).publish(
			`wkr.${this.name}`,
			JSON.stringify({
				ts: Date.now(),
				content: payload.toString()
			})
		);
	}

	sendRPC(payload: Buffer): Promise<Message> {
		return new Promise((resolve, reject) => {
			const rpcID = uuid();
			this.disposable.add(((this.driver as any).emitter as EventEmitter).once(rpcID, (resp) => {
				resolve({
					ts: Date.now(),
					content: resp
				});
			}));
			((this.driver as any).publisher as RedisClient).publish(
				`wkr.${this.name}`,
				JSON.stringify({
					ts: Date.now(),
					content: payload.toString(),
					$replyTo: rpcID
				})
			);
		});
	}

	consume(listener: ConsumeListener): Disposable {
		const event = ((this.driver as any).emitter as EventEmitter).on(
			`wkr.${this.name}`,
			(msg) => {
				return Promise.resolve<void | Buffer>(listener({
					ts: msg.ts,
					content: msg.content
				})).then(resp => {
					if (msg.$replyTo) {
						((this.driver as any).emitter as EventEmitter).emit(msg.$replyTo, resp)
					}
				});
			}
		);

		this.disposable.add(event);
		return event;
	}

}