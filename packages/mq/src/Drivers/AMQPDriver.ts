import { Disposable, CompositeDisposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import * as uuid from 'uuid/v4';
import { Driver, Channel, Queue, SubscribListener, ConsumeListener, Message } from '../Driver';
import { Options, Connection, Channel as LibChannel, Message as LibMessage } from 'amqplib/callback_api';

let connect: (url: string, socketOptions: any, callback: (err: any, connection: Connection) => void) => void;
try { connect = require('amqplib/callback_api').connect; } catch(e) { }

export class AMQPDriver extends Driver<AMQPChannel, AMQPQueue> {

	public readonly client: Connection | undefined;

	constructor(protected url: string, protected socketOptions?: any) {
		super();
	}

	connect(): Promise<this> {
		return new Promise((resolve, reject) => {
			connect(this.url, this.socketOptions, (err, conn) => {
				if (err) return reject(err);
				this.client! = conn!;
				resolve(this);
			})
		});
	}

	disconnect(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.client) {
				this.client.close((err) => {
					if (err) return reject(err);
					resolve();
				})
			} else {
				resolve();
			}
		});
	}

	createChannel(name: string, topic = ''): Promise<AMQPChannel> {
		return AMQPChannel.create(this, name, topic);
	}

	createQueue(name: string): Promise<AMQPQueue> {
		return AMQPQueue.create(this, name);
	}

}

export class AMQPChannel extends Channel<AMQPDriver> {
	protected emitter: EventEmitter
	protected disposable: CompositeDisposable

	public static create(
		driver: AMQPDriver,
		name: string,
		topic: string
	): Promise<AMQPChannel> {
		return new Promise((resolve, reject) => {
			if (driver.client === undefined) {
				reject(new Error(`Expected an active connection to AMQP server. Have you tried to connect first ?`));
			}
			else {
				driver.client.createChannel((err, channel) => {
					if (err) return reject(err);
					channel.assertExchange(name, 'topic', { durable: false });
					channel.assertQueue('', { exclusive: true }, (err, qu) => {
						if (err) return reject(err);
						channel.bindQueue(qu.queue, name, topic);
						resolve(new AMQPChannel(driver, name, topic, channel, qu.queue));
					});
				});
			}
		});
	}

	public constructor(
		protected readonly driver: AMQPDriver,
		protected readonly name: string,
		protected readonly topic: string,
		protected readonly channel: LibChannel,
		protected readonly queue: string
	) {
		super();
		this.emitter = new EventEmitter();
		this.disposable = new CompositeDisposable();
		this.disposable.add(new Disposable(() => this.emitter.dispose()));

		const consumerTag = uuid();
		const disposable = new Disposable(() => {
			this.channel.cancel(consumerTag, (err) => {
				if (err) throw err;
			});
		});

		this.channel.consume(this.queue, (msg) => {
			if (msg) {
				this.emitter.emit('consume', msg);
			}
		}, {
			consumerTag: consumerTag,
			noAck: true
		});

		this.disposable.add(disposable);
	}

	isDisposed(): boolean {
		return this.disposable.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.disposable.disposeAsync();
	}

	publish(payload: Buffer): void {
		this.channel.publish(this.name, this.topic, payload);
	}

	subscribe(listener: SubscribListener): Disposable {
		return this.emitter.on('consume', listener);
	}

}

export class AMQPQueue extends Queue<AMQPDriver> {
	protected emitter: EventEmitter
	protected disposable: CompositeDisposable

	public static async create(
		driver: AMQPDriver,
		name: string
	): Promise<AMQPQueue> {
		if (driver.client === undefined) {
			throw new Error(`Expected an active connection to AMQP server. Have you tried to connect first ?`);
		} else {
			const [channel, [replyToChannel, replyToQueue]] = await Promise.all<LibChannel, [LibChannel, string]>([
				new Promise((resolve, reject) => {
					driver.client!.createChannel((err, channel) => {
						if (err) return reject(err);
						channel.assertQueue(name, { durable: true });
						channel.prefetch(1);
						resolve(channel);
					});
				}),
				new Promise((resolve, reject) => {
					driver.client!.createChannel((err, channel) => {
						if (err) return reject(err);

						channel.assertQueue('', { exclusive: true }, (err, queue) => {
							if (err) return reject(err);
							resolve([channel, queue.queue]);
						});
					});
				})
			]);

			return new AMQPQueue(driver, name, channel, replyToChannel, replyToQueue);
		}
	}

	public constructor(
		protected readonly driver: AMQPDriver,
		protected readonly name: string,
		protected readonly channel: LibChannel,
		protected readonly replyToChannel: LibChannel,
		protected readonly replyToQueue: string
	) {
		super();
		this.emitter = new EventEmitter();
		this.disposable = new CompositeDisposable();
		this.disposable.add(new Disposable(() => this.emitter.dispose()));

		const consumerTag = uuid();
		const disposable = new Disposable(() => {
			this.channel.cancel(consumerTag, (err) => {
				if (err) throw err;
			});
		});

		this.channel.consume(replyToQueue, (msg) => {
			if (msg && msg.properties.correlationId) {
				const correlationId: string = msg.properties.correlationId.substr(0, -4);
				const status: number = parseInt(msg.properties.correlationId.substr(-3));
				this.emitter.emit(correlationId, status, msg);
			}
		}, {
			consumerTag: consumerTag,
			noAck: true
		});

		this.disposable.add(disposable);
	}

	isDisposed(): boolean {
		return this.disposable.isDisposed();
	}

	disposeAsync(): Promise<void> {
		return this.disposable.disposeAsync();
	}

	send(payload: Buffer): void {
		this.channel.sendToQueue(this.name, payload, {
			persistent: true
		});
	}

	sendRPC(payload: Buffer): Promise<Message> {
		return new Promise<Message>((resolve, reject) => {
			const rpcID = uuid();

			this.emitter.once(rpcID, (status: number, msg: Message) => {
				if (status === 200) return resolve(msg);
				reject(new Error(msg.content.toString('utf8')));
			});

			this.channel.sendToQueue(this.name, payload, {
				persistent: true,
				replyTo: this.replyToQueue,
				correlationId: rpcID
			});
		});
	}

	consume(listener: ConsumeListener): Disposable {
		const consumerTag = uuid();
		const disposable = new Disposable(() => {
			this.channel.cancel(consumerTag, (err) => {
				if (err) throw err;
			});
		});

		this.channel.consume(this.name, (msg) => {
			if (msg) {
				let promise: Promise<void | Buffer>;
				try {
					const listenerResponse = listener({
						ts: Date.now(),
						content: msg.content
					});

					promise = listenerResponse instanceof Promise ? listenerResponse : Promise.resolve(listenerResponse);
				} catch (err) {
					promise = Promise.reject(err);
				}

				promise
				.then(
					resp => {
						if (msg.properties.replyTo) {
							this.channel.sendToQueue(msg.properties.replyTo, resp ? resp : Buffer.from(''), {
								correlationId: `${msg.properties.correlationId}-200`
							});
						}
					},
					err => {
						if (msg.properties.replyTo) {
							this.channel.sendToQueue(msg.properties.replyTo, Buffer.from(err.message), {
								correlationId: `${msg.properties.correlationId}-500`
							});
						}
					}
				)
				.then(() => {
					this.channel.ack(msg);
				});
			}
		}, {
			consumerTag: consumerTag,
			noAck: false
		});
		
		this.disposable.add(disposable);
		return disposable;
	}

}