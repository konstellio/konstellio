import { createClient, RedisClient } from 'redis-mock';
import { Cache, Serializable } from '@konstellio/cache';

export class CacheMemory extends Cache {

	protected client: RedisClient;
	protected disposed: boolean;

	constructor() {
		super();

		this.client = createClient();
		this.disposed = false;
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	disposeAsync(): Promise<void> {
		return this.disposed
			? Promise.resolve()
			: new Promise((resolve, reject) => {
				this.client.once('end', resolve);
				this.client.quit();
			});
	}

	connect(): Promise<this> {
		return Promise.resolve(this);
	}

	disconnect(): Promise<void> {
		return this.disposeAsync();
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
				resolve(reply === 1);
			});
		});
	}

	set(key: string, value: Serializable, ttl?: number): Promise<void> {
		return new Promise((resolve, reject) => {
			if (ttl) {
				this.client.set(key, value && value.toString() || '', 'EX', ttl, (err) => {
					if (err) {
						return reject(err);
					}
					resolve();
				});
			} else {
				this.client.set(key, value && value.toString() || '', (err) => {
					if (err) {
						return reject(err);
					}
					resolve();
				});
			}
		});
	}

	unset(key: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.client.del(key, (err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	increment(key: string, amount?: number, ttl?: number): Promise<void> {
		return new Promise((resolve, reject) => {
			let cmd = this.client.multi().incrby(key, amount || 1);
			if (ttl) {
				cmd = cmd.expire(key, ttl);
			}
			cmd.exec((err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	decrement(key: string, amount?: number, ttl?: number): Promise<void> {
		return new Promise((resolve, reject) => {
			let cmd = this.client.multi().incrby(key, (amount || 1) * -1);
			if (ttl) {
				cmd = cmd.expire(key, ttl);
			}
			cmd.exec((err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	expire(key: string, ttl: number): Promise<void> {
		return new Promise((resolve, reject) => {
			this.client.expire(key, ttl, (err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}
}