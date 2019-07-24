import { Disposable, CompositeDisposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import * as uuid from 'uuid/v4';
import { MessageQueue, SubscribListener, ConsumeListener, Message, Payload } from '@konstellio/mq';
import { connect, Connection, Channel as LibChannel, Message as LibMessage } from 'amqplib/callback_api';
import { clearTimeout } from 'timers';

export class MessageQueueAMQP extends MessageQueue {
	private client!: Connection;
	private emitter: EventEmitter;
	private disposable: CompositeDisposable;
	private replyToChannel!: LibChannel;
	private replyToQueue!: string;
	private channels: Map<string, { channel: LibChannel; queue: string }>;
	private queues: Map<string, LibChannel>;

	constructor(protected url: string, protected socketOptions?: any) {
		super();
		this.emitter = new EventEmitter();
		this.disposable = new CompositeDisposable([]);
		this.disposable.add(new Disposable(() => this.emitter.dispose()));
		this.channels = new Map();
		this.queues = new Map();
	}

	connect(): Promise<this> {
		return new Promise<this>((resolve, reject) => {
			connect(
				this.url,
				this.socketOptions,
				(err, client) => {
					if (err) return reject(err);
					this.client = client;

					this.client.createChannel((err, channel) => {
						if (err) return reject(err);

						channel.assertQueue('', { exclusive: true }, (err, res) => {
							if (err) return reject(err);
							this.replyToChannel = channel;
							this.replyToQueue = res.queue;

							const consumerTag = uuid();
							const disposable = new Disposable(
								() =>
									new Promise<void>(resolve => {
										this.replyToChannel.close(() => {
											resolve();
										});
									})
							);

							this.replyToChannel.consume(
								this.replyToQueue,
								msg => {
									if (msg && msg.properties.correlationId) {
										const correlationId: string = msg.properties.correlationId.substr(0, -4);
										const status: number = parseInt(msg.properties.correlationId.substr(-3), 10);
										this.emitter.emit(correlationId, status, msg);
									}
								},
								{
									consumerTag,
									noAck: true,
								}
							);

							this.disposable.add(disposable);
							resolve(this);
						});
					});
				}
			);
		});
	}

	disconnect(): Promise<void> {
		return this.disposable.dispose().then(
			() =>
				new Promise<void>((resolve, reject) => {
					if (this.client) {
						this.client.close(err => {
							if (err) return reject(err);
							resolve();
						});
					} else {
						resolve();
					}
				})
		);
	}

	private async getChannel(name: string, topic = ''): Promise<{ channel: LibChannel; queue: string }> {
		return new Promise<{ channel: LibChannel; queue: string }>((resolve, reject) => {
			const hash = `${name}:${topic}`;
			if (this.channels.has(hash)) {
				return resolve(this.channels.get(hash)!);
			}
			this.client.createChannel((err, channel) => {
				if (err) return reject(err);
				channel.assertExchange(name, 'topic', { durable: false });
				channel.assertQueue('', { exclusive: true }, (err, res) => {
					if (err) return reject(err);
					channel.bindQueue(res.queue, name, topic);

					const consumerTag = uuid();
					const disposable = new Disposable(
						() =>
							new Promise((resolve, reject) => {
								channel.cancel(consumerTag, err => {
									if (err) return reject(err);
									resolve();
								});
							})
					);

					channel.consume(
						res.queue,
						msg => {
							if (msg) {
								const payload = JSON.parse(msg.content.toString('utf8'));
								this.emitter.emit(`channel:${name}:${topic}`, payload);
							}
						},
						{
							consumerTag,
							noAck: true,
						}
					);

					this.disposable.add(disposable);

					this.channels.set(hash, { channel, queue: res.queue });
					resolve({ channel, queue: res.queue });
				});
			});
		});
	}

	private async getQueue(name: string): Promise<LibChannel> {
		return new Promise<LibChannel>((resolve, reject) => {
			if (this.channels.has(name)) {
				return resolve(this.queues.get(name)!);
			}
			this.client.createChannel((err, channel) => {
				if (err) return reject(err);
				channel.prefetch(1);
				channel.assertQueue(name, { exclusive: true }, err => {
					if (err) return reject(err);
					this.queues.set(name, channel);
					resolve(channel);
				});
			});
		});
	}

	async publish(name: string, payload: Payload): Promise<void>;
	async publish(name: string, topic: string, payload: Payload): Promise<void>;
	async publish(name: string, topic: string | Payload, payload?: Payload): Promise<void> {
		if (typeof topic !== 'string') {
			payload = topic;
			topic = '';
		}
		const { channel } = await this.getChannel(name, topic);
		channel.publish(name, topic, Buffer.from(JSON.stringify(payload)));
	}

	async subscribe(name: string, listener: SubscribListener): Promise<Disposable>;
	async subscribe(name: string, topic: string, listener: SubscribListener): Promise<Disposable>;
	async subscribe(name: string, topic: string | SubscribListener, listener?: SubscribListener): Promise<Disposable> {
		if (typeof topic !== 'string') {
			listener = topic;
			topic = '';
		}

		if (listener === undefined) {
			throw new Error(`Expected listener to be of type SubscribListener, got ${listener}.`);
		}

		await this.getChannel(name, topic);

		const disposable = this.emitter.on(`channel:${name}:${topic}`, listener);
		this.disposable.add(disposable);
		return disposable;
	}

	async send(name: string, task: Payload): Promise<void> {
		const channel = await this.getQueue(name);
		channel.sendToQueue(name, Buffer.from(JSON.stringify(Object.assign({}, task, { ts: Date.now() }))), {
			persistent: true,
		});
	}

	rpc(name: string, task: Payload, timeout = 1000): Promise<Message> {
		return new Promise(async (resolve, reject) => {
			const rpcID = uuid();

			const timer = setTimeout(() => {
				reject(new Error(`RPC timeout (${timeout}ms).`));
			}, timeout);

			this.emitter.once(rpcID, (status: number, msg: LibMessage) => {
				clearTimeout(timer);
				if (status === 500) {
					return reject(new Error(msg.content.toString('utf8')));
				}

				const payload = JSON.parse(msg.content.toString('utf8'));
				resolve(payload);
			});

			const channel = await this.getQueue(name);
			channel.sendToQueue(name, Buffer.from(JSON.stringify(Object.assign({}, task, { ts: Date.now() }))), {
				persistent: true,
				replyTo: this.replyToQueue,
				correlationId: rpcID,
			});
		});
	}

	async consume(name: string, listener: ConsumeListener): Promise<Disposable> {
		const channel = await this.getQueue(name);

		const consumerTag = uuid();
		const disposable = new Disposable(
			() =>
				new Promise((resolve, reject) => {
					channel.cancel(consumerTag, err => {
						if (err) return reject(err);
						resolve();
					});
				})
		);

		channel.consume(
			name,
			async msg => {
				if (msg) {
					const payload = JSON.parse(msg.content.toString('utf8'));

					try {
						const response = await listener(payload);
						channel.ack(msg);
						if (msg.properties.replyTo) {
							channel.sendToQueue(
								msg.properties.replyTo,
								Buffer.from(response ? JSON.stringify(response) : ''),
								{
									correlationId: `${msg.properties.correlationId}-200`,
								}
							);
						}
					} catch (err) {
						if (msg.properties.replyTo) {
							channel.ack(msg);
							channel.sendToQueue(msg.properties.replyTo, Buffer.from(err.message), {
								correlationId: `${msg.properties.correlationId}-500`,
							});
						}
					}
				}
			},
			{
				consumerTag,
				noAck: false,
			}
		);

		this.disposable.add(disposable);
		return disposable;
	}
}

export default MessageQueueAMQP;
