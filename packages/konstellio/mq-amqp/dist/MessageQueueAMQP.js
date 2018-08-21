"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Disposable_1 = require("../../disposable/dist/Disposable");
const EventEmitter_1 = require("../../eventemitter/dist/EventEmitter");
const uuid = require("uuid/v4");
const mq_1 = require("@konstellio/mq");
const timers_1 = require("timers");
let connect;
try {
    connect = require('amqplib/callback_api').connect;
}
catch (e) { }
class MessageQueueAMQP extends mq_1.MessageQueue {
    constructor(url, socketOptions) {
        super();
        this.url = url;
        this.socketOptions = socketOptions;
        this.emitter = new EventEmitter_1.EventEmitter();
        this.disposable = new Disposable_1.CompositeDisposable();
        this.disposable.add(new Disposable_1.Disposable(() => this.emitter.isDisposed() && this.emitter.dispose()));
        this.channels = new Map();
        this.queues = new Map();
    }
    connect() {
        return new Promise((resolve, reject) => {
            connect(this.url, this.socketOptions, (err, client) => {
                if (err)
                    return reject(err);
                this.client = client;
                this.client.createChannel((err, channel) => {
                    if (err)
                        return reject(err);
                    channel.assertQueue('', { exclusive: true }, (err, res) => {
                        if (err)
                            return reject(err);
                        this.replyToChannel = channel;
                        this.replyToQueue = res.queue;
                        const consumerTag = uuid();
                        const disposable = new Disposable_1.Disposable(() => new Promise((resolve) => {
                            this.replyToChannel.close(() => {
                                resolve();
                            });
                        }));
                        this.replyToChannel.consume(this.replyToQueue, (msg) => {
                            if (msg && msg.properties.correlationId) {
                                const correlationId = msg.properties.correlationId.substr(0, -4);
                                const status = parseInt(msg.properties.correlationId.substr(-3));
                                this.emitter.emit(correlationId, status, msg);
                            }
                        }, {
                            consumerTag: consumerTag,
                            noAck: true
                        });
                        this.disposable.add(disposable);
                        resolve(this);
                    });
                });
            });
        });
    }
    disconnect() {
        return this.disposable.disposeAsync().then(() => new Promise((resolve, reject) => {
            if (this.client) {
                this.client.close((err) => {
                    if (err)
                        return reject(err);
                    resolve();
                });
            }
            else {
                resolve();
            }
        }));
    }
    getChannel(name, topic = '') {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const hash = `${name}:${topic}`;
                if (this.channels.has(hash)) {
                    return resolve(this.channels.get(hash));
                }
                this.client.createChannel((err, channel) => {
                    if (err)
                        return reject(err);
                    channel.assertExchange(name, 'topic', { durable: false });
                    channel.assertQueue('', { exclusive: true }, (err, res) => {
                        if (err)
                            return reject(err);
                        channel.bindQueue(res.queue, name, topic);
                        const consumerTag = uuid();
                        const disposable = new Disposable_1.Disposable(() => new Promise((resolve, reject) => {
                            channel.cancel(consumerTag, (err) => {
                                if (err)
                                    return reject(err);
                                resolve();
                            });
                        }));
                        channel.consume(res.queue, (msg) => {
                            if (msg) {
                                const payload = JSON.parse(msg.content.toString('utf8'));
                                this.emitter.emit(`channel:${name}:${topic}`, payload);
                            }
                        }, {
                            consumerTag: consumerTag,
                            noAck: true
                        });
                        this.disposable.add(disposable);
                        this.channels.set(hash, { channel, queue: res.queue });
                        resolve({ channel, queue: res.queue });
                    });
                });
            });
        });
    }
    getQueue(name) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (this.channels.has(name)) {
                    return resolve(this.queues.get(name));
                }
                this.client.createChannel((err, channel) => {
                    if (err)
                        return reject(err);
                    channel.prefetch(1);
                    channel.assertQueue(name, { exclusive: true }, (err) => {
                        if (err)
                            return reject(err);
                        this.queues.set(name, channel);
                        resolve(channel);
                    });
                });
            });
        });
    }
    publish(name, topic, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof topic !== 'string') {
                payload = topic;
                topic = '';
            }
            const { channel } = yield this.getChannel(name, topic);
            channel.publish(name, topic, Buffer.from(JSON.stringify(payload)));
        });
    }
    subscribe(name, topic, listener) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof topic !== 'string') {
                listener = topic;
                topic = '';
            }
            if (listener === undefined) {
                throw new Error(`Expected listener to be of type SubscribListener, got ${listener}.`);
            }
            yield this.getChannel(name, topic);
            const disposable = this.emitter.on(`channel:${name}:${topic}`, listener);
            this.disposable.add(disposable);
            return disposable;
        });
    }
    send(name, task) {
        return __awaiter(this, void 0, void 0, function* () {
            const channel = yield this.getQueue(name);
            channel.sendToQueue(name, Buffer.from(JSON.stringify(Object.assign({}, task, { ts: Date.now() }))), { persistent: true });
        });
    }
    rpc(name, task, timeout = 1000) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const rpcID = uuid();
            const timer = setTimeout(() => {
                reject(new Error(`RPC timeout (${timeout}ms).`));
            }, timeout);
            this.emitter.once(rpcID, (status, msg) => {
                timers_1.clearTimeout(timer);
                if (status === 500) {
                    return reject(new Error(msg.content.toString('utf8')));
                }
                const payload = JSON.parse(msg.content.toString('utf8'));
                resolve(payload);
            });
            const channel = yield this.getQueue(name);
            channel.sendToQueue(name, Buffer.from(JSON.stringify(Object.assign({}, task, { ts: Date.now() }))), {
                persistent: true,
                replyTo: this.replyToQueue,
                correlationId: rpcID
            });
        }));
    }
    consume(name, listener) {
        return __awaiter(this, void 0, void 0, function* () {
            const channel = yield this.getQueue(name);
            const consumerTag = uuid();
            const disposable = new Disposable_1.Disposable(() => new Promise((resolve, reject) => {
                channel.cancel(consumerTag, (err) => {
                    if (err)
                        return reject(err);
                    resolve();
                });
            }));
            channel.consume(name, (msg) => __awaiter(this, void 0, void 0, function* () {
                if (msg) {
                    const payload = JSON.parse(msg.content.toString('utf8'));
                    try {
                        const response = yield listener(payload);
                        channel.ack(msg);
                        if (msg.properties.replyTo) {
                            channel.sendToQueue(msg.properties.replyTo, Buffer.from(response ? JSON.stringify(response) : ''), {
                                correlationId: `${msg.properties.correlationId}-200`
                            });
                        }
                    }
                    catch (err) {
                        if (msg.properties.replyTo) {
                            channel.ack(msg);
                            channel.sendToQueue(msg.properties.replyTo, Buffer.from(err.message), {
                                correlationId: `${msg.properties.correlationId}-500`
                            });
                        }
                    }
                }
            }), {
                consumerTag: consumerTag,
                noAck: false
            });
            this.disposable.add(disposable);
            return disposable;
        });
    }
}
exports.MessageQueueAMQP = MessageQueueAMQP;
//# sourceMappingURL=MessageQueueAMQP.js.map