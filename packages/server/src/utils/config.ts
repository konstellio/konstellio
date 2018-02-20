import { dirname, join } from 'path';
import { exists as _exists, readFile as _readFile } from 'fs';
import { promisify } from 'util';
import * as yaml from 'js-yaml';

const exists = promisify(_exists);
const readfile = promisify(_readFile);

export async function parseConfig(file: string): Promise<Config> {
	if (await exists(file) === false) {
		throw new Error(`Configuration file ${file} not found.`);
	}

	const config: Config = yaml.safeLoad(await readfile(file));
	if (typeof config.version === 'undefined' || typeof config.konstellio === 'undefined') {
		throw new Error(`Configuration file ${file} is not a valid.`);
	}

	return config;
}

export interface Config {
	version: string

	konstellio: {
		server?: {
			host?: string
			port?: number
		}
		locales?: { [code: string]: string }
		plugins?: string[]
		database: DBConfig
		fs: FSConfig
		cache: CacheConfig
		mq: MQConfig
	}
}

export type DBConfig = SQLiteDBConfig | MySQLDBConfig;

export interface SQLiteDBConfig {
	driver: 'sqlite'
	filename: string
	mode?: number
	verbose?: boolean
}

export interface MySQLDBConfig {
	driver: 'mysql'
	host: string
	port?: number
	username: string
	password?: string
	database: string
	charset?: string
}

export type FSConfig = LocalFSConfig

export interface LocalFSConfig {
	driver: 'local'
	root: string
}

export type CacheConfig = RedisCacheConfig | MemoryCacheConfig

export interface RedisCacheConfig {
	driver: 'redis'
	uri: string
}

export interface MemoryCacheConfig {
	driver: 'memory'
}

export type MQConfig = AMQPMQConfig | MemoryMQConfig

export interface AMQPMQConfig {
	driver: 'amqp'
	uri: string
}

export interface MemoryMQConfig {
	driver: 'memory'
}