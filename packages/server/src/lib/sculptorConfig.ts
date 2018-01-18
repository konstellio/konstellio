
export interface SculptorConfig {
	version: string

	sculptor: {

		server?: {
			host?: string
			port?: number
		}

		graphql?: SculptorGraphql

		database: SculptorDB

		fs: SculptorFS

		cache: SculptorCache

		mq: SculptorMQ

	}
}

export interface SculptorGraphql {
	schemas?: string[]
	resolvers?: string[]
}

export type SculptorDB = SculptorDBSQLite | SculptorDBMySQL

export interface SculptorDBSQLite {
	driver: 'sqlite'
	filename: string
	mode?: number
	verbose?: boolean
}

export interface SculptorDBMySQL {
	driver: 'mysql'
	host: string
	port?: number
	username: string
	password?: string
	database: string
	charset?: string
}

export type SculptorFS = SculptorFSLocal

export interface SculptorFSLocal {
	driver: 'local'
	root: string
}

export type SculptorCache = SculptorCacheRedis

export interface SculptorCacheRedis {
	driver: 'redis'
	uri: string
}

export type SculptorMQ = SculptorMQAMQP

export interface SculptorMQAMQP {
	driver: 'amqp'
	uri: string
}