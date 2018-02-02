import { Disposable, CompositeDisposable } from '@konstellio/disposable';
import { EventEmitter } from '@konstellio/eventemitter';
import * as uuid from 'uuid/v4';
import { ClientOpts, RedisClient } from 'redis';
import { Channel, Queue, SubscribListener, ConsumeListener, Message } from '../Driver';
import { RedisDriver } from './RedisDriver';

export class RedisMockDriver extends RedisDriver {

	constructor() {
		let createClient: undefined | ((redis_url: string, options?: ClientOpts) => RedisClient);
		try {
			createClient = require('redis-mock').createClient;
		} catch (e) {
			throw new Error(`Could not load redis-mock client. Maybe try "npm install redis-mock" ?`);
		}

		super('', undefined, createClient);
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
}