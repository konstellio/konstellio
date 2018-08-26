import { Cache, Serializable } from '@konstellio/cache';
import { ClientOpts, RedisClient, createClient } from 'redis';

export class CacheRedis extends Cache {

	protected client: RedisClient;
	protected disposed: boolean;

	constructor(redis_url: string, options?: ClientOpts, clientFactory?: (redis_url: string, options?: ClientOpts) => RedisClient) {
		super();

		this.client = (clientFactory || createClient)(redis_url, options);
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
				});
			});
	}

	connect(): Promise<this> {
		return Promise.resolve(this);
	}

	disconnect(): Promise<void> {
		return this.disposeAsync();
	}

	set(key: string, value: Serializable, ttl: number): Promise<void> {
		return new Promise((resolve, reject) => {
			this.client.set(key, value.toString(), 'EX', ttl, (err) => {
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


}