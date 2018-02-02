import { Disposable, CompositeDisposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import * as uuid from 'uuid/v4';
import { ClientOpts, RedisClient } from 'redis';
import { Driver, Channel, Queue, SubscribListener, ConsumeListener, Message } from '../Driver';

export class RedisDriver extends Driver<RedisChannel, RedisQueue> {

	protected subscriber: RedisClient
	protected publisher: RedisClient
	protected emitter: EventEmitter
	protected createClient: (redis_url: string, options?: ClientOpts) => RedisClient

	constructor(redis_url: string, options?: ClientOpts, createClient?: (redis_url: string, options?: ClientOpts) => RedisClient) {
		super();

		try {
			this.createClient = createClient || require('redis').createClient;
		} catch (e) {
			throw new Error(`Could not load redis client. Maybe try "npm install redis" ?`);
		}

		this.subscriber = this.createClient(redis_url, options);
		this.publisher = this.createClient(redis_url, options);
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
		return Promise.all([
			new Promise((resolve, reject) => {
				this.subscriber.unsubscribe();
				this.subscriber.quit((err) => {
					if (err) return reject(err);
					this.subscriber! = undefined!;
					resolve();
				});
			}),
			new Promise((resolve, reject) => {
				this.publisher.quit((err) => {
					if (err) return reject(err);
					this.publisher! = undefined!;
					resolve();
				});
			})
		])
			.then(() => { });
	}

	connect(): Promise<this> {
		return Promise.resolve(this);
	}

	disconnect(): Promise<void> {
		return this.disposeAsync();
	}

	createChannel(name: string, topic?: string): Promise<RedisChannel> {
		return Promise.resolve(new RedisChannel(this, name, topic));
	}

	createQueue(name: string): Promise<RedisQueue> {
		return Promise.resolve(new RedisQueue(this, name));
	}
}

export class RedisChannel extends Channel<RedisDriver> {

	protected disposable: CompositeDisposable

	public constructor(
		protected readonly driver: RedisDriver,
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
		})).then(() => { });
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

export class RedisQueue extends Queue<RedisDriver> {

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