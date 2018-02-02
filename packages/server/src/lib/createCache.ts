import { ConfigCache } from './interfaces';
import { Driver, RedisDriver, RedisMockDriver } from '@konstellio/cache';

export async function createCache(config: ConfigCache, context?: any): Promise<Driver> {

	if (config.driver === 'redis') {
		if (config.uri === 'mock://memory') {
			return new RedisMockDriver().connect();
		} else {
			return new RedisDriver(config.uri).connect();
		}
	}

	return Promise.reject(new ReferenceError(`Unsupported cache driver ${config.driver}.`));
}