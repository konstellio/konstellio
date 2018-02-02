import { Disposable, CompositeDisposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import * as uuid from 'uuid/v4';
import { Driver, Channel, Queue, SubscribListener, ConsumeListener, Message } from '../Driver';
import { Options, Connection, Channel as LibChannel, Message as LibMessage } from 'amqplib/callback_api';

let connect: (url: string, socketOptions: any, callback: (err: any, connection: Connection) => void) => void;
try { connect = require('amqplib/callback_api').connect; } catch(e) { }

// TODO Moves AMQPQueue.createReplyChannel to AMQPDriver class. Should only need 1 reply queue per connection. See RedisDriver.

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
		return new Promise((resolve, reject) => {
			if (!this.client) {
				reject(new Error(`Expected an active connection to AMQP server. Have you tried to connect first ?`));
			} else {
				this.client.createChannel((err, ch) => {
					if (err) return reject(err);
					ch.assertExchange(name, 'topic', { durable: false });
					ch.assertQueue('', { exclusive: true }, (err, qu) => {
						ch.bindQueue(qu.queue, name, topic);
						resolve(new AMQPChannel(this, name, topic, ch, qu.queue));
					});
				});
			}
		});
	}

	createQueue(name: string): Promise<AMQPQueue> {
		return new Promise((resolve, reject) => {
			if (!this.client) {
				reject(new Error(`Expected an active connection to AMQP server. Have you tried to connect first ?`));
			} else {
				this.client.createChannel((err, ch) => {
					if (err) return reject(err);
					ch.assertQueue(name, { durable: true });
					ch.prefetch(1);
					resolve(new AMQPQueue(this, name, ch));
				});
			}
		});
	}

}

export class AMQPChannel extends Channel<AMQPDriver> {
	protected disposable: CompositeDisposable

	public constructor(
		protected readonly driver: AMQPDriver,
		protected readonly name: string,
		protected readonly topic: string,
		protected readonly channel: LibChannel,
		protected readonly queue: string
	) {
		super();
		this.disposable = new CompositeDisposable();
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
		const consumerTag = uuid();
		const disposable = new Disposable(() => {
			this.channel.cancel(consumerTag, (err) => {
				if (err) throw err;
			});
		});

		this.channel.consume(this.queue, (msg) => {
			if (msg) {
				listener({
					ts: Date.now(),
					content: msg.content
				});
			}
		}, {
			consumerTag: consumerTag,
			noAck: true
		});

		this.disposable.add(disposable);
		return disposable;
	}

}

export class AMQPQueue extends Queue<AMQPDriver> {
	protected disposable: CompositeDisposable
	protected replyTo?: string
	protected replyEmitter: EventEmitter

	public constructor(
		protected readonly driver: AMQPDriver,
		protected readonly name: string,
		protected readonly channel: LibChannel
	) {
		super();
		this.disposable = new CompositeDisposable();
		this.replyEmitter = new EventEmitter();

		this.disposable.add(new Disposable(this.replyEmitter.disposeAsync));
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

	protected createReplyChannel(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.driver.client) {
				return reject(new Error(`Expected an active connection to AMQP server. Have you tried to connect first ?`));
			}
			else if (!this.replyTo) {
				this.driver.client.createChannel((err, ch) => {
					if (err) return reject(err);

					ch.assertQueue('', { exclusive: true }, (err, qu) => {
						if (err) return reject(err);

						this.replyTo = qu.queue;

						ch.consume(this.replyTo, (msg) => {
							if (msg && msg.properties.correlationId) {
								this.replyEmitter.emit(msg.properties.correlationId, msg);
							}
						}, { noAck: true });

						resolve();
					});
				});
			}
			else {
				resolve();
			}
		})
	}

	sendRPC(payload: Buffer): Promise<Message> {
		return this.createReplyChannel().then(() => new Promise<Message>((resolve, reject) => {
			const rpcID = uuid();

			this.replyEmitter.once(rpcID, (msg: LibMessage) => {
				resolve({
					ts: Date.now(),
					content: msg.content
				});
			});

			this.channel.sendToQueue(this.name, payload, {
				persistent: true,
				replyTo: this.replyTo,
				correlationId: rpcID
			});
		}));
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
				Promise.resolve<void | Buffer>(listener({
					ts: Date.now(),
					content: msg.content
				})).then(resp => {
					this.channel.ack(msg);

					if (msg.properties.replyTo) {
						this.channel.sendToQueue(msg.properties.replyTo, resp ? resp : Buffer.from(''), {
							correlationId: msg.properties.correlationId
						});
					}
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