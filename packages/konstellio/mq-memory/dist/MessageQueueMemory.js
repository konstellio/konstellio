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
const disposable_1 = require("@konstellio/disposable");
const eventemitter_1 = require("@konstellio/eventemitter");
const mq_1 = require("@konstellio/mq");
const timers_1 = require("timers");
class MessageQueueMemory extends mq_1.MessageQueue {
    constructor(retryPendingTaskEvery = 2000) {
        super();
        this.emitter = new eventemitter_1.EventEmitter();
        this.disposable = new disposable_1.CompositeDisposable();
        this.disposable.add(new disposable_1.Disposable(() => this.emitter.isDisposed() && this.emitter.dispose()));
        this.consumers = new Map();
        this.pendingTasks = [];
        const pendingTimer = timers_1.setInterval(() => {
            this.pendingTasks = this.pendingTasks.reduce((pending, { queue, task, done }) => {
                if (this.consumers.has(queue)) {
                    if (done !== undefined) {
                        this.rpc(queue, task).then(done, done);
                    }
                    else {
                        this.send(queue, task);
                    }
                }
                else {
                    pending.push({ queue, task, done });
                }
                return pending;
            }, []);
        }, retryPendingTaskEvery);
        this.disposable.add(new disposable_1.Disposable(() => timers_1.clearInterval(pendingTimer)));
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.disposable.disposeAsync();
            return;
        });
    }
    publish(name, topic, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            let event = `channel:${name}`;
            if (typeof topic === 'string') {
                event += `:${topic}`;
            }
            else {
                payload = topic;
            }
            this.emitter.emit(event, payload);
        });
    }
    subscribe(name, topic, listener) {
        return __awaiter(this, void 0, void 0, function* () {
            let event = `channel:${name}`;
            if (typeof topic === 'string') {
                event += `:${topic}`;
            }
            else {
                listener = topic;
            }
            if (listener === undefined) {
                throw new Error(`Expected listener to be of type SubscribListener, got ${listener}.`);
            }
            const disposable = this.emitter.on(event, listener);
            this.disposable.add(disposable);
            return disposable;
        });
    }
    send(name, task) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.consumers.has(name)) {
                const queueList = this.consumers.get(name);
                const next = (++queueList.next) % queueList.consumers.length;
                queueList.next = next;
                try {
                    queueList.consumers[next](Object.assign({}, task, {
                        ts: Date.now(),
                    }));
                }
                catch (err) {
                    this.pendingTasks.push({ queue: name, task });
                }
            }
            else {
                this.pendingTasks.push({ queue: name, task });
            }
        });
    }
    rpc(name, task, timeout = 1000) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const timer = setTimeout(() => {
                reject(new Error(`RPC timeout (${timeout}ms).`));
            }, timeout);
            if (this.consumers.has(name)) {
                const queueList = this.consumers.get(name);
                const next = (++queueList.next) % queueList.consumers.length;
                queueList.next = next;
                try {
                    const result = yield queueList.consumers[next](Object.assign({}, task, {
                        ts: Date.now(),
                    }));
                    timers_1.clearTimeout(timer);
                    resolve(result ? result : { ts: Date.now() });
                }
                catch (err) {
                    timers_1.clearTimeout(timer);
                    reject(err);
                }
            }
            else {
                this.pendingTasks.push({ queue: name, task, done: (resp) => {
                        if (resp instanceof Error)
                            return reject(resp);
                        resolve(resp);
                    } });
            }
        }));
    }
    consume(name, listener) {
        return __awaiter(this, void 0, void 0, function* () {
            const disposable = new disposable_1.Disposable(() => {
                if (this.consumers.has(name)) {
                    const queueList = this.consumers.get(name);
                    const idx = queueList.consumers.indexOf(listener);
                    if (idx > -1) {
                        queueList.consumers.splice(idx);
                        if (queueList.consumers.length === 0) {
                            this.consumers.delete(name);
                        }
                    }
                }
            });
            if (this.consumers.has(name) === false) {
                this.consumers.set(name, { consumers: [listener], next: -1 });
            }
            else {
                this.consumers.get(name).consumers.push(listener);
            }
            this.disposable.add(disposable);
            return disposable;
        });
    }
}
exports.MessageQueueMemory = MessageQueueMemory;
//# sourceMappingURL=MessageQueueMemory.js.map