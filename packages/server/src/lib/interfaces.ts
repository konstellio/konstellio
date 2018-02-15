import { Driver as DB } from '@konstellio/db';
import { Driver as FS } from '@konstellio/fs';
import { Driver as Cache } from '@konstellio/cache';
import { Driver as MQ, Message, Payload } from '@konstellio/mq';
import { GraphQLFieldResolver, GraphQLTypeResolver, GraphQLIsTypeOfFn, GraphQLScalarType } from 'graphql';
import { Request, Response } from '../../node_modules/@types/express-serve-static-core/index';

export interface Config {
	version: string

	sculptor: {
		server?: {
			host?: string
			port?: number
		}
		plugins?: string[]
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

export type ConfigCache = ConfigCacheRedis | ConfigCacheMemory

export interface ConfigCacheRedis {
	driver: 'redis'
	uri: string
}

export interface ConfigCacheMemory {
	driver: 'memory'
}

export type ConfigMQ = ConfigMQAMQP | ConfigMQMemory

export interface ConfigMQAMQP {
	driver: 'amqp'
	uri: string
}

export interface ConfigMQMemory {
	driver: 'memory'
}

export interface PluginContext {
	db: DB
	fs: FS
	cache: Cache
	mq: MQ
}

export interface Plugin {
	graphql?: string
	resolvers?: IResolvers
	routes?: PluginRoutes
	tasks?: PluginTasks
}

export type PluginRoutes = { [route: string]: PluginRoute }
export type PluginRoute = {
	get: (req: Request, res: Response) => Promise<void>
	post: (req: Request, res: Response) => Promise<void>
}

export type PluginTasks = { [task: string]: PluginTask }
export type PluginTask = (msg: Message) => Promise<Payload>

export interface GraphQLContext {
	db: DB
	fs: FS
	cache: Cache
	mq: MQ
}

export interface IResolverOptions {
	resolve?: GraphQLFieldResolver<any, GraphQLContext>;
	subscribe?: GraphQLFieldResolver<any, GraphQLContext>;
	__resolveType?: GraphQLTypeResolver<any, GraphQLContext>;
	__isTypeOf?: GraphQLIsTypeOfFn<any, GraphQLContext>;
}
export declare type IResolverObject = {
	[key: string]: GraphQLFieldResolver<any, GraphQLContext> | IResolverOptions;
};
export interface IResolvers {
	[key: string]: (() => any) | IResolverObject | GraphQLScalarType;
}