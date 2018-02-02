import { ConfigMQ } from './interfaces';
import { Driver, Channel, Queue, AMQPDriver, RedisDriver, RedisMockDriver } from '@konstellio/mq';

export async function createMessageQueue(config: ConfigMQ, context?: any): Promise<Driver> {
	
	if (config.driver === 'redis') {
		if (config.uri === 'mock://memory') {
			return new RedisMockDriver().connect();
		} else {
			return new RedisDriver(config.uri).connect();
		}
	}
	else if (config.driver === 'amqp') {
		return new AMQPDriver(config.uri)
	}

	return Promise.reject(new ReferenceError(`Unsupported message queue driver ${config!.driver}.`));
}