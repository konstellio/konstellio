import { SculptorCache } from './sculptorConfig';
import * as redisMock from 'redis-mock';
import * as redis from 'redis';

export async function createCache(config: SculptorCache): Promise<any> {

	let cache;

	switch (config.driver) {
		case 'redis':
			cache = config.uri === 'mock://memory'
				? redisMock.createClient() as redis.RedisClient
				: redis.createClient(config.uri);
			break;
		default:
			throw new ReferenceError(`Unsupported cache driver ${config.driver}.`);
	}

	return cache;
}