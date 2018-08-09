export interface Config {
	locales: Locales
	database: DBConfig
	http?: {
		host?: string
		port?: number
	}
	plugins?: string[]
	fs?: FSConfig
	cache?: CacheConfig
	mq?: MQConfig
}

export type Locales = {
	[code: string]: string
};

export interface HTTPConfig {
	host?: string
	port?: number
	http2?: boolean
	https?: {
		key: string
		cert: string
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