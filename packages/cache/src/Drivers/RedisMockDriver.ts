import { ClientOpts, RedisClient } from 'redis';
import { Driver, Serializable } from "../Driver";

let createClient: () => RedisClient;
try { createClient = require('redis-mock').createClient; } catch (e) {}


export class RedisMockDriver extends Driver {

    protected client: RedisClient

    constructor() {
        super();

        this.client = createClient();
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
				resolve(!!reply);
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