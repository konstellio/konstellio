import { Driver as CacheDriver, RedisDriver, RedisMockDriver } from '@konstellio/cache';
import { Driver as DBDriver, SQLiteDriver, } from '@konstellio/db';
import { Driver as FSDriver, LocalDriver } from '@konstellio/fs';
import { Driver as MQDriver, AMQPDriver, MemoryDriver } from '@konstellio/mq';
import { CacheConfig, DBConfig, FSConfig, MQConfig } from './config';

export async function createCache(config: CacheConfig): Promise<CacheDriver> {
	if (config.driver === 'memory') {
		return new RedisMockDriver().connect();
	}
	else if (config.driver === 'redis') {
		return new RedisDriver(config.uri).connect();
	}

	throw new ReferenceError(`Unsupported cache driver ${config!.driver}.`);
}

export async function createDatabase(config: DBConfig): Promise<DBDriver> {
	if (config.driver === 'sqlite') {
		return new SQLiteDriver(
			config.filename === 'mock://memory'
				? Object.assign({}, config, { filename: ':memory:' })
				: config
		).connect();
	}

	throw new ReferenceError(`Unsupported database driver ${config.driver}.`);
}

export async function createFilesystem(config: FSConfig): Promise<FSDriver> {
	if (config.driver === 'local') {
		return new LocalDriver(config.root);
	}

	throw new ReferenceError(`Unsupported file system driver ${config.driver}.`);
}

export async function createMessageQueue(config: MQConfig): Promise<MQDriver> {
	if (config.driver === 'memory') {
		return new MemoryDriver().connect();
	}
	else if (config.driver === 'amqp') {
		return new AMQPDriver(config.uri).connect();
	}

	throw new ReferenceError(`Unsupported message queue driver ${config!.driver}.`);
}