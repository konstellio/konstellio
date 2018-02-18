import { GraphQLFieldResolver, GraphQLTypeResolver, GraphQLIsTypeOfFn, GraphQLScalarType } from 'graphql';
import { Driver as CacheDriver } from '@konstellio/cache';
import { Driver as DBDriver } from '@konstellio/db';
import { Driver as FSDriver } from '@konstellio/fs';
import { Driver as MQDriver } from '@konstellio/mq';
import basePlugin from '../lib/basePlugin';
import * as resolvePackage from 'resolve';

export async function loadPlugins(context: PluginInitContext, baseDir: string, plugins = [] as string[]): Promise<Plugin[]> {
	return Promise.all([Promise.resolve(basePlugin)].concat(plugins.map<Promise<Plugin>>(name => new Promise<Plugin>((resolve, reject) => {
		resolvePackage(name, { basedir: baseDir }, (err, fullPath) => {
			if (err) return reject(err);
			resolve(require(fullPath!));
		});
	}))));
}

export interface Plugin {
	graphql?: (context: PluginInitContext) => Promise<string>
	resolvers?: () => Promise<IResolvers>
	// routes?: PluginRoutes
	// tasks?: PluginTasks
}

export interface PluginInitContext {
	database: DBDriver
	fs: FSDriver
	cache: CacheDriver
	message: MQDriver
}

export interface GraphContext {
	database: DBDriver
	fs: FSDriver
	cache: CacheDriver
	message: MQDriver
}

export interface IResolverOptions {
	resolve?: GraphQLFieldResolver<any, GraphContext>;
	subscribe?: GraphQLFieldResolver<any, GraphContext>;
	__resolveType?: GraphQLTypeResolver<any, GraphContext>;
	__isTypeOf?: GraphQLIsTypeOfFn<any, GraphContext>;
}
export declare type IResolverObject = {
	[key: string]: GraphQLFieldResolver<any, GraphContext> | IResolverOptions;
};
export interface IResolvers {
	[key: string]: (() => any) | IResolverObject | GraphQLScalarType;
}