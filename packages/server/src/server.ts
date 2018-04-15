import { Driver as CacheDriver } from '@konstellio/cache';
import { Driver as DBDriver, q } from '@konstellio/db';
import { Driver as FSDriver } from '@konstellio/fs';
import { Driver as MQDriver } from '@konstellio/mq';
import { EventEmitter } from '@konstellio/eventemitter';
import { IDisposableAsync } from '@konstellio/disposable';
import { createServer, Server as HTTPServer } from 'http';
import { Express } from '../node_modules/@types/express-serve-static-core/index';
import * as express from 'express';
import * as resolvePackage from 'resolve';
import { promisify } from 'util';
import { graphqlExpress } from 'apollo-server-express';
import playgroundExpress from 'graphql-playground-middleware-express';
import * as bodyParser from 'body-parser';
import { IResolvers } from 'graphql-tools/dist/Interfaces';
import { makeExecutableSchema } from 'graphql-tools';
import { ReadStream, WriteStream } from 'tty';

import { Config, Locales } from './utils/config';
import { createDatabase, createFilesystem, createCache, createMessageQueue } from './utils/driver';
import { PluginConstructor, Plugin } from './plugin';
import { CorePlugin } from './plugins/core';
import { getSchemaDocument, parseSchema } from './utils/schema';
import { getSchemaDiff, executeSchemaMigration } from './utils/migration';
import { getRecords, Record } from './utils/record';
import { getResolvers } from './utils/graph';

const resolve: (path: string, opts: resolvePackage.AsyncOpts) => Promise<string> = <any>promisify(resolvePackage);

export enum ServerStartMode {
	Normal = ~(~0 << 2),
	GraphQL = 1 << 0,
	Worker = 1 << 1
}

export interface ServerStartOptions {
	skipMigration?: boolean
	mode?: ServerStartMode
}

export interface ServerStartStatus {
	mode: ServerStartMode
	family?: string
	address?: string
	port?: number
}

export class Server implements IDisposableAsync {

	static async create(config: Config, cwd = './'): Promise<Server> {
		const [db, fs, cache, queue] = await Promise.all([
			createDatabase(config.konstellio.database),
			createFilesystem(config.konstellio.fs),
			createCache(config.konstellio.cache),
			createMessageQueue(config.konstellio.mq)
		]);

		const pluginPaths = config.konstellio.plugins || [];
		const plugins: PluginConstructor[] = [CorePlugin];
		for (let path of pluginPaths) {
			const realPath = await resolve(path, { basedir: cwd });
			plugins.push(require(realPath) as PluginConstructor);
		}

		return new Server(
			config,
			db,
			fs,
			cache,
			queue,
			plugins
		);
	}

	private disposed: boolean;
	private expressApp?: Express;
	private httpServer?: HTTPServer;

	public readonly plugins: Plugin[];

	constructor(
		public readonly config: Config,
		public readonly database: DBDriver,
		public readonly filesystem: FSDriver,
		public readonly cache: CacheDriver,
		public readonly queue: MQDriver,
		pluginConstructors: PluginConstructor[]
	) {
		this.disposed = false;

		this.plugins = pluginConstructors.map(constructor => new constructor(this));
	}

	start({ skipMigration, mode }: ServerStartOptions = {}): Promise<ServerStartStatus> {
		return new Promise(async (resolve, reject) => {
			if (this.isDisposed()) {
				return reject(new Error(`Can not call Server.listen on a disposed server.`));
			}

			skipMigration = !!skipMigration;
			mode = mode || ServerStartMode.Normal;

			const status: ServerStartStatus = { mode };
			
			const pluginGraphQLs = await Promise.all(this.plugins.map<Promise<string>>(plugin => plugin.getGraphQL ? plugin.getGraphQL() : Promise.resolve('')));
			const graphDocument = await getSchemaDocument(pluginGraphQLs);
			const graphSchemas = parseSchema(graphDocument);

			const locales: Locales = this.config.konstellio.locales || { en: 'English' };
			const schemaDiffs = await getSchemaDiff(this.database, locales, graphSchemas);

			if (schemaDiffs.length > 0) {
				if (skipMigration === true || !!process.stdout.isTTY === false) {
					return reject(new Error(`Schema has change and some migration is required. Please use a terminal to complete the migration wizard.`));
				}
				try {
					await executeSchemaMigration(this.database, schemaDiffs, process.stdin as ReadStream, process.stdout as WriteStream);
				}
				catch (err) {
					return reject(new Error(`Could not complete schema migration : ${err.stack}`));
				}
			}

			const schemaRecords = await getRecords(this.database, locales, graphSchemas);

			const pluginGraphResolvers = await Promise.all(this.plugins.map<Promise<IResolvers>>(plugin => plugin.getGraphResolvers ? plugin.getGraphResolvers(graphDocument) : Promise.resolve({})));
			const graphResolvers = await getResolvers(locales, pluginGraphResolvers, graphSchemas);

			const graphSchema = makeExecutableSchema({
				typeDefs: graphDocument,
				resolvers: graphResolvers,
				resolverValidationOptions: {
					allowResolversNotInSchema: true
				}
			});

			if (mode & ServerStartMode.GraphQL) {
				await new Promise((resolve, reject) => {
					this.expressApp = express();
					this.expressApp.disable('x-powered-by');

					// TODO auth request

					this.expressApp.use(
						'/playground',
						playgroundExpress({
							endpoint: '/graphql'
						})
					);

					this.expressApp.use(
						'/graphql',
						bodyParser.urlencoded({ extended: true }),
						bodyParser.json(),
						graphqlExpress((req) => {

							// TODO reduce graphDocument for request user

							return {
								schema: graphSchema,
								context: {
									q,
									req,
									records: schemaRecords
								}
							}
						})
					);

					const onError = err => reject(err);
					this.httpServer = createServer(this.expressApp);
					this.httpServer.once('error', onError);
					this.httpServer.listen(
						this.config.konstellio.server && this.config.konstellio.server.port || 8080,
						this.config.konstellio.server && this.config.konstellio.server.host || '127.0.0.1',
						() => {
							this.httpServer!.removeListener('error', onError);
							const addr = this.httpServer!.address();
							status.family = addr.family;
							status.address = addr.address;
							status.port = addr.port;
							resolve();
						}
					);
				})
			}

			return resolve(status);
		});
	}

	disposeAsync(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.disposed === true) {
				return resolve();
			}
			
			if (this.httpServer) {
				const onError = err => reject(err);
				this.httpServer.once('error', onError);
				this.httpServer.close(() => {
					this.httpServer!.removeListener('error', onError);
					this.disposed = true;
					resolve();
				});
			}
		});
	}

	isDisposed(): boolean {
		return this.disposed;
	}
}