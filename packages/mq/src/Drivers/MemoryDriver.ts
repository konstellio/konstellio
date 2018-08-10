import { Disposable, CompositeDisposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import { Driver, SubscribListener, ConsumeListener, Message, Payload } from '../Driver';
import { clearTimeout, setInterval, clearInterval } from 'timers';

type ConsumerList = {
	consumers: ConsumeListener[]
	next: number
}

type PendingTask = {
	queue: string
	task: Payload
	done?: (response: Error | any) => void
}

export class MemoryDriver extends Driver {

	private emitter: EventEmitter
	private disposable: CompositeDisposable
	private consumers: Map<string, ConsumerList>
	private pendingTasks: PendingTask[]

	constructor(retryPendingTaskEvery = 2000) {
		super();
		this.emitter = new EventEmitter();
		this.disposable = new CompositeDisposable();
		this.disposable.add(new Disposable(() => this.emitter.isDisposed() && this.emitter.dispose()));
		this.consumers = new Map();
		this.pendingTasks = [];

		const pendingTimer = setInterval(() => {
			this.pendingTasks = this.pendingTasks.reduce<PendingTask[]>((pending, { queue, task, done }) => {
				if (this.consumers.has(queue)) {
					if (done !== undefined) {
						this.rpc(queue, task).then(done, done);
					} else {
						this.send(queue, task)
					}
				} else {
					pending.push({ queue, task, done });
				}
				return pending;
			}, []);
		}, retryPendingTaskEvery);
		this.disposable.add(new Disposable(() => clearInterval(pendingTimer)));
	}

	async connect(): Promise<this> {
		return this;
	}

	async disconnect(): Promise<void> {
		await this.disposable.disposeAsync();
		return;
	}

	async publish(name: string, payload: Payload): Promise<void>
	async publish(name: string, topic: string, payload: Payload): Promise<void>
	async publish(name: string, topic: string | Payload, payload?: Payload): Promise<void> {
		let event = `channel:${name}`;
		if (typeof topic === 'string') {
			event += `:${topic}`;
		} else {
			payload = topic;
		}
		this.emitter.emit(event, payload);
	}

	async subscribe(name: string, listener: SubscribListener): Promise<Disposable>
	async subscribe(name: string, topic: string, listener: SubscribListener): Promise<Disposable>
	async subscribe(name: string, topic: string | SubscribListener, listener?: SubscribListener): Promise<Disposable> {
		let event = `channel:${name}`;
		if (typeof topic === 'string') {
			event += `:${topic}`;
		} else {
			listener = topic;
		}

		if (listener === undefined) {
			throw new Error(`Expected listener to be of type SubscribListener, got ${listener}.`);
		}

		const disposable = this.emitter.on(event, listener);
		this.disposable.add(disposable);
		return disposable;
	}

	async send(name: string, task: Payload): Promise<void> {
		if (this.consumers.has(name)) {
			const queueList = this.consumers.get(name)!;
			const next = (++queueList.next) % queueList.consumers.length;
			queueList.next = next;
			try {
				queueList.consumers[next](Object.assign({}, task, {
					ts: Date.now(),
				}));
			} catch (err) {
				this.pendingTasks.push({ queue: name, task });
			}
		}
		else {
			this.pendingTasks.push({ queue: name, task });
		}
	}

	rpc(name: string, task: Payload, timeout = 1000): Promise<Message> {
		return new Promise(async (resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error(`RPC timeout (${timeout}ms).`));
			}, timeout);

			if (this.consumers.has(name)) {
				const queueList = this.consumers.get(name)!;
				const next = (++queueList.next) % queueList.consumers.length;
				queueList.next = next;
				try {
					const result = await queueList.consumers[next](Object.assign({}, task, {
						ts: Date.now(),
					}));
					clearTimeout(timer);
					resolve(result ? result : { ts: Date.now() });
				} catch (err) {
					clearTimeout(timer);
					reject(err);
				}
			} else {
				this.pendingTasks.push({ queue: name, task, done: (resp) => {
					if (resp instanceof Error) return reject(resp);
					resolve(resp);
				}});
			}
		});
	}

	async consume(name: string, listener: ConsumeListener): Promise<Disposable> {
		const disposable = new Disposable(() => {
			if (this.consumers.has(name)) {
				const queueList = this.consumers.get(name)!;
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
		} else {
			this.consumers.get(name)!.consumers.push(listener);
		}
		this.disposable.add(disposable);
		return disposable;
	}
}