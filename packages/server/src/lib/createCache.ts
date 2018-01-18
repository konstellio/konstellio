import { SculptorCache } from './sculptorConfig';

export async function createCache(config: SculptorCache, context?: any): Promise<any> {

	let cache;

	switch (config.driver) {
		case 'redis':
			if (config.uri === 'mock://memory') {
				const redis = require.main!.require('redis-mock');
				cache = redis.createClient();
			} else {
				const redis = require.main!.require('redis');
				cache = redis.createClient(config.uri);
			}
			break;
		default:
			throw new ReferenceError(`Unsupported cache driver ${config.driver}.`);
	}

	return cache;
}