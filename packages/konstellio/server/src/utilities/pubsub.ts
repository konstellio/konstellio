import { MessageQueue, SubscribListener } from '@konstellio/mq';
import { Disposable } from '@konstellio/disposable';
import { PubSubEngine } from 'graphql-subscriptions';
import { isArray } from 'util';

export class MQPubSub implements PubSubEngine {
	protected currentSubscriptionId: number;
	protected subscriptionMap: Map<number, Disposable>;

	constructor(
		protected mq: MessageQueue
	) {
		this.currentSubscriptionId = 0;
		this.subscriptionMap = new Map();
	}

	publish(triggerName: string, payload: any): Promise<void> {
		return this.mq.publish(triggerName, payload);
	}
	
	async subscribe(triggerName: string, onMessage: SubscribListener, options: Object): Promise<number> {
		const id = this.currentSubscriptionId++;
		const disposable = await this.mq.subscribe(triggerName, onMessage);
		this.subscriptionMap.set(id, disposable);
		return id;
	}

	unsubscribe(subId: number) {
		if (!this.subscriptionMap.has(subId)) {
			throw new Error(`There is no subscription of id "${subId}".`);
		}
		const disposable = this.subscriptionMap.get(subId)!;
		disposable.dispose();
		this.subscriptionMap.delete(subId);
	}

	asyncIterator<T>(triggers: string | string[]): AsyncIterator<T> {
		return new PubSubAsyncIterator<T>(this, triggers);
	}

}

// Borowed from https://github.com/davidyaha/graphql-mqtt-subscriptions/blob/master/src/mqtt-pubsub.ts
export class PubSubAsyncIterator<T> implements AsyncIterator<T> {

	protected pullQueue: Function[];
	protected pushQueue: any[];
	protected listening: boolean;
	protected eventsArray: string[];
	protected allSubscribed: Promise<number[]>;

	constructor(
		protected pubsub: PubSubEngine,
		eventNames: string | string[]
	) {
		this.pullQueue = [];
		this.pushQueue = [];
		this.listening = true;
		this.eventsArray = isArray(eventNames) ? eventNames : [eventNames];
		this.allSubscribed = this.subscribeAll();
	}

	public async next(): Promise<IteratorResult<T>> {
		await this.allSubscribed;
		return this.listening ? this.pullValue() : this.return();
	}

	public async return(): Promise<IteratorResult<T>> {
		this.emptyQueue(await this.allSubscribed);
		return { value: undefined, done: true } as any;
	}

	public async throw(error: any): Promise<IteratorResult<T>> {
		this.emptyQueue(await this.allSubscribed);
		return Promise.reject(error);
	}

	public [Symbol.asyncIterator]() {
		return this;
	}

	private async pushValue(event: any) {
		await this.allSubscribed;
		if (this.pullQueue.length !== 0) {
			this.pullQueue.shift()!({ value: event, done: false });
		} else {
			this.pushQueue.push(event);
		}
	}

	private pullValue(): Promise<IteratorResult<any>> {
		return new Promise(resolve => {
			if (this.pushQueue.length !== 0) {
				resolve({ value: this.pushQueue.shift(), done: false });
			} else {
				this.pullQueue.push(resolve);
			}
		});
	}
	
	private emptyQueue(subscriptionIds: number[]) {
		if (this.listening) {
			this.listening = false;
			this.unsubscribeAll(subscriptionIds);
			this.pullQueue.forEach(resolve => resolve({ value: undefined, done: true }));
			this.pullQueue.length = 0;
			this.pushQueue.length = 0;
		}
	}

	private subscribeAll() {
		return Promise.all(this.eventsArray.map(eventName => this.pubsub.subscribe(eventName, this.pushValue.bind(this), {})));
	}
	
	private unsubscribeAll(subscriptionIds: number[]) {
		for (const subscriptionId of subscriptionIds) {
			this.pubsub.unsubscribe(subscriptionId);
		}
	}
}