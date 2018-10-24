import { Cache } from '@konstellio/cache';
import { Database } from '@konstellio/db';
import { FileSystem } from '@konstellio/fs';
import { MessageQueue } from '@konstellio/mq';
import { IDisposableAsync } from '@konstellio/disposable';
import * as assert from 'assert';
import { ApolloServer, Request, Response } from './lib/apolloServer';
import * as fastify from 'fastify';
import { Plugin } from './lib/plugin';
import CorePlugin from './plugins/core';
import { parse } from 'graphql';
import { mergeAST } from './lib/utilities/ast';
import { ReadStream, WriteStream } from 'tty';
import { createCollections, Collection } from './collection';
import { createTypeExtensionsFromDefinitions, createTypeExtensionsFromDatabaseDriver } from './lib/collection/createTypeExtensions';
import { createInputTypeFromDefinitions } from './lib/collection/createInputType';
import { makeExecutableSchema, transformSchema, ReplaceFieldWithFragment, SchemaDirectiveVisitor } from 'graphql-tools';
import { AddressInfo } from 'net';
import { createSchemaFromDefinitions } from './lib/migration/createSchemaFromDefinitions';
import { createSchemaFromDatabase } from './lib/migration/createSchemaFromDatabase';
import { promptSchemaDiffs } from './lib/migration/promptSchemaDiffs';
import { computeSchemaDiff } from './lib/migration/computeSchemaDiff';
import { executeSchemaDiff } from './lib/migration/executeSchemaDiff';

type Mutable<T> = {
	-readonly[P in keyof T]: T[P]
};

export interface ServerListenOptions {
	skipMigration?: boolean;
}

export interface ServerListenStatus {
	family?: string;
	address?: string;
	port?: number | string;
}

export interface ServerConfig {
	locales: Locales;
	fs: FileSystem;
	db: Database;
	cache: Cache;
	mq: MessageQueue;
	http?: {
		host?: string
		port?: number
		sslKey?: string
		sslCert?: string
		http2?: boolean
	};
	plugins?: string[];
}

export type Locales = {
	[code: string]: string
};

export interface HTTPConfig {
	host?: string;
	port?: number;
	http2?: boolean;
	https?: {
		key: string
		cert: string
	};
}

export async function createServer(config: ServerConfig): Promise<Server> {
	return new Server(config);
}

export class Server implements IDisposableAsync {

	private disposed: boolean;
	private plugins: Plugin[];

	public readonly app!: fastify.FastifyInstance;
	public readonly apollo!: ApolloServer;
	public readonly fs: FileSystem;
	public readonly db: Database;
	public readonly cache: Cache;
	public readonly mq: MessageQueue;

	constructor(
		public readonly config: ServerConfig
	) {
		this.disposed = false;
		this.plugins = [CorePlugin as Plugin];

		this.fs = config.fs;
		this.db = config.db;
		this.cache = config.cache;
		this.mq = config.mq;
	}

	async disposeAsync(): Promise<void> {
		if (this.disposed) {
			return;
		}

		// FIXME: Expose missing disposeAsync;

		// await this.db.disposeAsync();
		await this.fs.disposeAsync();
		await this.cache.disposeAsync();
		// await this.mq.disposeAsync();
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	register(plugin: Plugin) {
		assert(plugin.identifier, 'Plugin needs an identifier');
		this.plugins.push(plugin);
	}

	async listen({ skipMigration }: ServerListenOptions = {}): Promise<ServerListenStatus> {
		if (this.isDisposed()) {
			throw new Error(`Can not call Server.listen on a disposed server.`);
		}

		skipMigration = !!skipMigration;
		const status: ServerListenStatus = { };

		await this.db.connect();
		await this.cache.connect();
		await this.mq.connect();

		// Gather plugins type definition
		const typeDefs = await Promise.all(this.plugins.map(async (plugin) => {
			return plugin.getTypeDef ? plugin.getTypeDef(this) : '';
		}));

		// Parse type definition to AST
		const ASTs = typeDefs.map(typeDef => parse(typeDef));

		// Let plugin extend AST by providing an other layer of type definition
		const typeDefExtensions: string[] = [
			createTypeExtensionsFromDatabaseDriver(this.db, this.config.locales)
		];
		for (const ast of ASTs) {
			const extended = await Promise.all(this.plugins.reduce((typeDefs, plugin) => {
				if (plugin.getTypeExtension) {
					typeDefs.push(Promise.resolve(plugin.getTypeExtension(this, ast)));
				}
				return typeDefs;
			}, [
				Promise.resolve(createTypeExtensionsFromDefinitions(ast, this.config.locales))
			] as Promise<string>[]));

			const typeDefExtension = extended.join(`\n`).trim();
			if (typeDefExtension) {
				typeDefExtensions.push(typeDefExtension);
			}
		}
		ASTs.push(...typeDefExtensions.map(typeDef => parse(typeDef)));

		// Merge every AST
		const mergedAST = mergeAST(ASTs);

		const astSchema = await createSchemaFromDefinitions(mergedAST, this.config.locales, this.db.features.join);
		
		// Do migration
		if (!skipMigration) {
			const dbSchema = await createSchemaFromDatabase(this.db, this.config.locales);
			const schemaDiffs = await promptSchemaDiffs(
				process.stdin as ReadStream,
				process.stdout as WriteStream,
				computeSchemaDiff(dbSchema, astSchema, this.db.compareTypes),
				this.db.compareTypes
			);

			if (schemaDiffs.length > 0) {
				await executeSchemaDiff(schemaDiffs, this.db);
			}
		}

		// Create collections with mergedAST
		const collections = createCollections(this.db, astSchema, mergedAST, this.config.locales).reduce((collections, collection) => {
			collections[collection.name] = collection;
			return collections;
		}, {} as { [name: string]: Collection<any, any> });

		// Create input type from definitions
		const inputTypeDefinitions = createInputTypeFromDefinitions(mergedAST, this.config.locales);

		// Gather plugins resolvers
		const resolvers = await Promise.all(this.plugins.map(async (plugin) => {
			return plugin.getResolvers ? plugin.getResolvers(this) : {};
		}));

		// Merge every resolvers
		const mergedResolvers = resolvers.reduce((resolvers, resolver) => {
			Object.keys(resolver).forEach(key => {
				resolvers[key] = Object.assign(resolvers[key] || {}, resolver[key]);
			});
			return resolvers;
		}, {});

		// Create fragment from resolvers
		const fragments = Object.keys(mergedResolvers).reduce((fragments, typeName) => {
			const type: any = mergedResolvers[typeName];
			return Object.keys(type).reduce((fragments, fieldName) => {
				const field = type[fieldName];
				if (typeof field === 'object' && typeof field.resolve === 'function' && typeof field.fragment === 'string') {
					fragments.push({ field: fieldName, fragment: field.fragment });
				}
				return fragments;
			}, fragments);
		}, [] as { field: string, fragment: string }[]);

		// Create schema
		const baseSchema = makeExecutableSchema({
			typeDefs: [mergedAST, inputTypeDefinitions] as any,
			resolvers: mergedResolvers,
			resolverValidationOptions: {
				allowResolversNotInSchema: true,
				requireResolversForResolveType: false
			}
		});

		// Emulate mergeSchemas resolver's fragment
		const extendedSchema = transformSchema(baseSchema, [
			new ReplaceFieldWithFragment(baseSchema, fragments)
		]);

		// Setup fastify routes and handlers
		(this as Mutable<Server>).app = fastify();
		this.plugins.forEach(plugin => plugin.setupRoutes && plugin.setupRoutes(this));

		// Prepare GraphQL directives
		const directiveRecords = await Promise.all(this.plugins.map(plugin => plugin.getDirectives && plugin.getDirectives(this)) as Promise<undefined | Record<string, typeof SchemaDirectiveVisitor>>[]);
		const directives = directiveRecords.reduce<Record<string, typeof SchemaDirectiveVisitor>>((directives, directiveRecord) => {
			if (directiveRecord) {
				Object.assign(directives, directiveRecord);
			}
			return directives;
		}, {});

		// Setup Apollo server
		(this as Mutable<Server>).apollo = new ApolloServer({
			schema: extendedSchema,
			schemaDirectives: directives as any, // TODO : graph-tools dependency mixup... need to use type `any`
			context: async ({ req, res }: { req: Request, res: Response }) => {
				const ctx = {
					collections,
					db: this.db,
					cache: this.cache,
					mq: this.mq,
					fs: this.fs
				};

				for (const plugin of this.plugins) {
					if (plugin.setupContext) {
						Object.assign(ctx, await plugin.setupContext(this, req, res));
					}
				}

				return ctx;
			}
		});

		this.apollo.applyMiddleware({ app: this.app });
		this.apollo.installSubscriptionHandlers(this.app.server);

		// Start server
		const info = await this.app!.listen(
			this.config.http && this.config.http.port || 8080,
			this.config.http && this.config.http.host || '127.0.0.1'
		).then(() => {
			const { family, address, port } = this.app!.server.address() as AddressInfo;
			return { family, address, port };
		});

		return info;
	}
}

export { Request, Response, Plugin };