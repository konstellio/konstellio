import { Driver, Serializable } from '../Driver';
import { ClientOpts, RedisClient } from 'redis';

let createClient: (options: ClientOpts) => RedisClient;
try { createClient = require('redis').createClient; } catch (e) {}

export class RedisDriver extends Driver {

	protected client: RedisClient
	protected disposed: boolean

	constructor(protected options: ClientOpts) {
		super();

		this.client = createClient(this.options);
		this.disposed = false;
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	disposeAsync(): Promise<void> {
		return this.disposed
			? Promise.resolve()
			: new Promise((resolve, reject) => {
				this.client.quit((err) => {
					if (err) return reject(err);
					resolve();
				})
			});
	}

	set(key: string, value: Serializable, ttl: number): Promise<void> {
		return new Promise((resolve, reject) => {
			this.client.set(key, value.toString(), (err, reply) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	expire(key: string, ttl: number): Promise<void> {
		return new Promise((resolve, reject) => {
			this.client.expire(key, ttl, (err, reply) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	get(key: string): Promise<Serializable> {
		return new Promise((resolve, reject) => {
			this.client.get(key, (err, reply) => {
				if (err) {
					return reject(err);
				}
				resolve(reply);
			});
		});
	}

	has(key: string): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.exists(key, (err, reply) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	unset(key: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.client.del(key, (err, reply) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}


}