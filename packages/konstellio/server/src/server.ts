import { Configuration, loadConfiguration } from './config';
import { dirname } from 'path';
import * as resolve from 'resolve';
import { Extension, Context, Callable, LoadedExtension } from './extension';
import { parse, DocumentNode, Kind, DefinitionNode, ObjectTypeDefinitionNode, FieldDefinitionNode, TypeNode, UnionTypeDefinitionNode, GraphQLSchema } from 'graphql';
import { Database } from '@konstellio/db';
import { FileSystem } from '@konstellio/fs';
import { Cache } from '@konstellio/cache';
import { MessageQueue } from '@konstellio/mq';
import { Collection, Schema, Object, ObjectBase, Union, UnionBase, Field, FieldType, Index } from '@konstellio/odm';
import { mergeAST, isCollection, isListType, getDefNodeByNamedType, isNonNullType, getArgumentsValues } from './util/ast';
import baseExtension from './extension/base';
import authExtension from './extension/auth';
import { IResolvers, SchemaDirectiveVisitor, makeExecutableSchema, transformSchema, ReplaceFieldWithFragment } from 'graphql-tools';
import * as fastify from 'fastify';
import { ApolloServer } from 'apollo-server-fastify';

export async function createServer<
	C extends Context = Context
>(
	conf: string | { basedir: string, configuration: Configuration }
) {
	const basedir = typeof conf === 'string' ? dirname(conf) : conf.basedir;
	const configuration = typeof conf === 'string' ? await loadConfiguration(conf) : conf.configuration;

	const context = await loadContext<C>(configuration, basedir);

	const loadedExtensions = await loadExtensions(configuration, basedir, context);
	
	const typeDefs = loadTypeDefs(loadedExtensions);
	const directives = loadDirectives(loadedExtensions);
	const resolvers = loadResolvers(loadedExtensions);

	const collectionSchemas = loadCollectionSchemas(typeDefs);
	context.collection = collectionSchemas.reduce((collections, schema) => {
		collections[schema.handle] = new Collection(
			context.database,
			configuration.locales ? Object.values(configuration.locales) : [],
			schema
		);
		return collections;
	}, {} as Context['collection']);

	const app = await loadFastifyInstance(configuration, context, loadedExtensions);
	
	const graphQLSchema = await loadGraphQLSchema(typeDefs, resolvers, directives);
	const apollo = new ApolloServer({
		schema: graphQLSchema,
		schemaDirectives: directives, // TODO : Still needed, isn't baked into graphQLSchema already ?
		context(req: any) {
			return req.context;
		},

		playground: true,
		// tracing: true,
		// cacheControl: true
	});

	app.register(apollo.createHandler());

	return {
		configuration,
		context,
		app,
		graphQLSchema,
		collectionSchemas
	};
}

async function resolveModule(path: string, basedir: string) {
	return new Promise<string>((res, rej) => {
		resolve(path, { basedir }, (err, path) => {
			if (err) {
				return rej(err);
			}
			return res(path);
		});
	});
}

export async function loadContext<C extends Context = Context>(configuration: Configuration, basedir: string): Promise<C> {
	const [database, filesystem, cache, mq] = await loadDrivers(configuration, basedir);

	await database.connect();
	await cache.connect();
	await mq.connect();

	return {
		database,
		filesystem,
		cache,
		mq,
		collection: {}
	} as C;
}

export async function loadExtensions(configuration: Configuration, basedir: string, context: Context): Promise<LoadedExtension[]> {
	const serviceResolvers = await Promise.all((configuration.extensions || []).map(path => resolveModule(path, basedir)));
	const extensions = serviceResolvers.map(path => require(path).default as Extension);
	extensions.unshift(authExtension as any);
	extensions.unshift(baseExtension as any);

	const loadedExtensions: LoadedExtension[] = [];

	for (const extension of extensions) {
		loadedExtensions.push({
			typeDefs: extension.typeDefs ? await callCallable(extension.typeDefs!, configuration, context, loadedExtensions) : undefined,
			resolvers: extension.resolvers ? await callCallable(extension.resolvers!, configuration, context, loadedExtensions) : undefined,
			directives: extension.directives ? await callCallable(extension.directives!, configuration, context, loadedExtensions) : undefined,
			main: extension.main
		});
	}

	return loadedExtensions;
}

async function loadDrivers(configuration: Configuration, basedir: string): Promise<[Database, FileSystem, Cache, MessageQueue]> {
	return Promise.all([
		loadDriver<Database>(configuration.database, basedir),
		loadDriver<FileSystem>(configuration.filesystem, basedir),
		loadDriver<Cache>(configuration.cache, basedir),
		loadDriver<MessageQueue>(configuration.mq, basedir)
	]);
}

async function loadDriver<T>(configuration: Configuration['database'] | Configuration['filesystem'] | Configuration['cache'] | Configuration['mq'], basedir: string): Promise<T> {
	const { driver, ...opts } = configuration;
	const resolved = await resolveModule(driver, basedir);
	const driverConstructor: (new(opts: any) => T) = require(resolved).default;
	return new driverConstructor(opts);
}

async function callCallable<T>(callable: Callable<T>, configuration: Configuration, context: Context, extensions: Extension[]): Promise<T> {
	if (typeof callable === 'function') {
		callable = Promise.resolve((callable as any)(configuration, context, extensions));
	}
	if (callable instanceof Promise) {
		return Promise.resolve(callable);
	}
	return callable;
}

export function loadCollectionSchemas(typeDef: DocumentNode): Schema[] {
	return typeDef.definitions.reduce((schemas, node) => {
		if (isCollection(node)) {
			schemas.push(mapTypeDefinitionToSchema(node));
		}
		return schemas;
	}, [] as Schema[]);

	function mapTypeDefinitionToSchema(node: DefinitionNode): Schema {
		if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
			return {
				...mapObjectTypeDefinitionToObjectBase(node),
				indexes: mapTypeDefinitionToIndex(node)
			} as Object;
		}
		else if (node.kind === Kind.UNION_TYPE_DEFINITION) {
			return {
				...mapUnionTypeDefinitionToUnionBase(node),
				indexes: mapTypeDefinitionToIndex(node)
			} as Union;
		}
		else {
			throw new TypeError(`Specified node ${node.kind} is not supported.`);
		}
	}

	function mapTypeDefinitionToIndex(node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): Index[] {
		return (node.directives || []).reduce((indexes, directive) => {
			if (directive.name.value === 'collection') {
				const args = getArgumentsValues(directive.arguments);
				indexes.push(...(args.indexes || [] as Index[]));
			}
			return indexes;
		}, [] as Index[]);
	}
	
	function mapObjectTypeDefinitionToObjectBase(node: ObjectTypeDefinitionNode): ObjectBase {
		return {
			handle: node.name.value,
			fields: (node.fields || []).reduce((fields, node) => {
				const field = mapFieldDefinitionToField(node);
				if (field) {
					fields.push(field);
				}
				return fields;
			}, [] as Field[])
		};
	}

	function mapUnionTypeDefinitionToUnionBase(node: UnionTypeDefinitionNode): UnionBase {
		return {
			handle: node.name.value,
			objects: (node.types || []).reduce((objects, node) => {
				const refNode = getDefNodeByNamedType(typeDef, node.name.value);
				if (refNode && refNode.kind === Kind.OBJECT_TYPE_DEFINITION) {
					objects.push(mapObjectTypeDefinitionToObjectBase(refNode));
				}
				return objects;
			}, [] as ObjectBase[])
		};
	}
	
	function mapFieldDefinitionToField(node: FieldDefinitionNode): Field | undefined {
		const directives = node.directives || [];
		const computed = directives.find(directive => directive.name.value === 'computed') !== undefined;
		if (computed) {
			return;
		}
		const multiple = isListType(node.type);
		const required = isNonNullType(node.type);
		const localized = directives.find(directive => directive.name.value === 'localized') !== undefined;

		const [type, relation] = mapTypeToFieldType(node.type);
	
		return {
			required,
			localized,
			multiple,
			type,
			relation,
			handle: node.name.value,
			// size?: number;
		};
	}
	
	function mapTypeToFieldType(node: TypeNode): [FieldType, boolean] {
		if (node.kind === Kind.NON_NULL_TYPE || node.kind === Kind.LIST_TYPE) {
			return mapTypeToFieldType(node.type);
		}
	
		switch (node.name.value) {
			case 'ID':
			case 'String':
				return ['string', false];
			case 'Int':
				return ['int', false];
			case 'Float':
				return ['float', false];
			case 'Boolean':
				return ['boolean', false];
			case 'Date':
				return ['date', false];
			case 'DateTime':
				return ['datetime', false];
			default:
				const refNode = getDefNodeByNamedType(typeDef, node.name.value);
				if (refNode) {
					if (refNode.kind === Kind.ENUM_TYPE_DEFINITION) {
						return ['string', false];
					}
					else if (refNode.kind === Kind.OBJECT_TYPE_DEFINITION) {
						return [mapObjectTypeDefinitionToObjectBase(refNode), isCollection(refNode)];
					}
					else if (refNode.kind === Kind.UNION_TYPE_DEFINITION) {
						return [mapUnionTypeDefinitionToUnionBase(refNode), isCollection(refNode)];
					}
				}
		}
		return ['string', false];
	}
}

export function loadTypeDefs(loadedExtensions: LoadedExtension[]): DocumentNode {
	const typeDefs = loadedExtensions.reduce((documents, extension) => {
		if (extension.typeDefs) {
			documents.push(typeof extension.typeDefs === 'string' ? parse(extension.typeDefs) : extension.typeDefs);
		}
		return documents;
	}, [] as DocumentNode[]);
	
	return mergeAST(typeDefs);
}

export function loadResolvers(loadedExtensions: LoadedExtension[]): IResolvers {
	return loadedExtensions.reduce((resolvers, extension) => {
		if (extension.resolvers) {
			const resolver = extension.resolvers;
			Object.keys(resolver).forEach(key => {
				resolvers[key] = Object.assign(resolvers[key] || {}, resolver[key]);
			});
		}
		return resolvers;
	}, {} as IResolvers);
}

export function loadDirectives(loadedExtensions: LoadedExtension[]): Record<string, typeof SchemaDirectiveVisitor> {
	return loadedExtensions.reduce((directives, extension) => {
		if (extension.directives) {
			return {
				...directives,
				...extension.directives
			};
		}
		return directives;
	}, {} as Record<string, typeof SchemaDirectiveVisitor>);
}

export function loadGraphQLSchema(typeDefs: DocumentNode, resolvers: IResolvers, directives: Record<string, typeof SchemaDirectiveVisitor>): GraphQLSchema {
	const baseSchema = makeExecutableSchema({
		typeDefs,
		resolvers,
		schemaDirectives: directives,
		resolverValidationOptions: {
			allowResolversNotInSchema: true,
			requireResolversForResolveType: false
		}
	});

	const fragments = Object.keys(resolvers).reduce((fragments, typeName) => {
		const type: any = resolvers[typeName];
		return Object.keys(type).reduce((fragments, fieldName) => {
			const field = type[fieldName];
			if (typeof field === 'object' && typeof field.resolve === 'function' && typeof field.fragment === 'string') {
				fragments.push({ field: fieldName, fragment: field.fragment });
			}
			return fragments;
		}, fragments);
	}, [] as { field: string, fragment: string }[]);

	const extendedSchema = transformSchema(baseSchema, [
		new ReplaceFieldWithFragment(baseSchema, fragments)
	]);

	return extendedSchema;
}

export async function loadFastifyInstance(configuration: Configuration, context: Context, loadedExtensions: LoadedExtension[]): Promise<fastify.FastifyInstance> {
	const app = fastify();

	app.addHook('preHandler', async (request, response) => {
		request.context = {
			...context
		} as any;
	});
	
	const mains = loadedExtensions.filter(extension => extension.main).map(extension => extension.main!);
	for (const main of mains) {
		await main({ app, configuration, context, loadedExtensions });
	}

	return app;
}