import { DocumentNode } from 'graphql';
import { IResolvers, SchemaDirectiveVisitor } from 'graphql-tools';
import { FastifyInstance } from 'fastify';

import { Database } from '@konstellio/db';
import { FileSystem } from '@konstellio/fs';
import { Cache } from '@konstellio/cache';
import { MessageQueue } from '@konstellio/mq';
import { Collection } from '@konstellio/odm';
import { Configuration } from './config';

export interface Context {
	database: Database;
	filesystem: FileSystem;
	cache: Cache;
	mq: MessageQueue;
	collection: {
		[name: string]: Collection
	};
}

export type Callable<T, C extends Context = Context> = T
	| Promise<T>
	| ((configuration: Configuration, context: C, extensions: Extension<C>[]) => T | Promise<T>);

export interface Extension<C extends Context = Context> {
	typeDefs?: Callable<string | DocumentNode, C>;
	resolvers?: Callable<IResolvers<any, C>, C>;
	directives?: Callable<Record<string, typeof SchemaDirectiveVisitor>, C>;
	main?: (app: FastifyInstance, configuration: Configuration, context: C, extensions: Extension<C>[]) => void | Promise<void>;
}