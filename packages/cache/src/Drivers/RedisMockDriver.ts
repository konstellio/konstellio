import { ClientOpts, RedisClient } from 'redis';
import { RedisDriver } from './RedisDriver';

let createClient: () => RedisClient;
try { createClient = require('redis-mock').createClient; } catch (e) {}


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
		return this.disposed
			? Promise.resolve() 
			: new Promise((resolve, reject) => {
				this.client.quit(); // No callback in redis-mock
				resolve();
			});
	}

}