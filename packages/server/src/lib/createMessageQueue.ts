import { ConfigMQ } from './interfaces';
import { Driver, AMQPDriver, MemoryDriver } from '@konstellio/mq';

export async function createMessageQueue(config: ConfigMQ, context?: any): Promise<Driver> {
	
	if (config.driver === 'memory') {
		return new MemoryDriver().connect();
	}
	else if (config.driver === 'amqp') {
		return new AMQPDriver(config.uri).connect();
	}

	return Promise.reject(new ReferenceError(`Unsupported message queue driver ${config!.driver}.`));
}