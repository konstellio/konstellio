import { ConfigCache, PluginContext } from './interfaces';
import { Driver, RedisDriver, RedisMockDriver } from '@konstellio/cache';

export async function createCache(config: ConfigCache): Promise<Driver> {

	if (config.driver === 'memory') {
		return new RedisMockDriver().connect();
	}
	else if (config.driver === 'redis') {
		return new RedisDriver(config.uri).connect();
	}

	return Promise.reject(new ReferenceError(`Unsupported cache driver ${config!.driver}.`));
}