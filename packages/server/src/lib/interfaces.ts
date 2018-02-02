import { Driver as DB } from '@konstellio/db';
import { Driver as FS } from '@konstellio/fs';
import { Driver as Cache } from '@konstellio/cache';
import { Driver as MQ } from '@konstellio/mq';
import { GraphQLFieldResolver, GraphQLTypeResolver, GraphQLIsTypeOfFn, GraphQLScalarType } from 'graphql';

export interface Config {
	version: string

	sculptor: {
		server?: {
			host?: string
			port?: number
		}
		graphql?: ConfigGraphql
		database: ConfigDB
		fs: ConfigFS
		cache: ConfigCache
		mq: ConfigMQ
	}
}

export interface ConfigGraphql {
	schemas?: string[]
	resolvers?: string[]
}

export type ConfigDB = ConfigDBSQLite | ConfigDBMySQL

export interface ConfigDBSQLite {
	driver: 'sqlite'
	filename: string
	mode?: number
	verbose?: boolean
}

export interface ConfigDBMySQL {
	driver: 'mysql'
	host: string
	port?: number
	username: string
	password?: string
	database: string
	charset?: string
}

export type ConfigFS = ConfigFSLocal

export interface ConfigFSLocal {
	driver: 'local'
	root: string
}

export type ConfigCache = ConfigCacheRedis

export interface ConfigCacheRedis {
	driver: 'redis'
	uri: string
}

export type ConfigMQ = ConfigMQAMQP | ConfigMQRedis

export interface ConfigMQAMQP {
	driver: 'amqp'
	uri: string
}

export interface ConfigMQRedis {
	driver: 'redis'
	uri: string
}

export interface Context {
	db: DB
	fs: FS
	cache: Cache
	mq: MQ
}

export interface IResolverOptions {
	resolve?: GraphQLFieldResolver<any, Context>;
	subscribe?: GraphQLFieldResolver<any, Context>;
	__resolveType?: GraphQLTypeResolver<any, Context>;
	__isTypeOf?: GraphQLIsTypeOfFn<any, Context>;
}
export declare type IResolverObject = {
	[key: string]: GraphQLFieldResolver<any, Context> | IResolverOptions;
};
export interface IResolvers {
	[key: string]: (() => any) | IResolverObject | GraphQLScalarType;
}