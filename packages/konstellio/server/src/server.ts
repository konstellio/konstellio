import { Configuration, loadConfiguration } from './config';
import { dirname } from 'path';
import * as resolve from 'resolve';
import { Extension, Context, Callable } from './extension';
import { parse, DocumentNode, Kind, DefinitionNode, ObjectTypeDefinitionNode, FieldDefinitionNode, TypeNode, UnionTypeDefinitionNode, GraphQLSchema } from 'graphql';
import { Database } from '@konstellio/db';
import { FileSystem } from '@konstellio/fs';
import { Cache } from '@konstellio/cache';
import { MessageQueue } from '@konstellio/mq';
import { Collection, Schema, Object, ObjectBase, Union, Field, FieldType, Index } from '@konstellio/odm';
import { mergeAST, isCollection, isListType, getDefNodeByNamedType, isNonNullType, getArgumentsValues } from './util/ast';
import baseExtension from './extension/base';
import authExtension from './extension/auth';
import { IResolvers, SchemaDirectiveVisitor, makeExecutableSchema, transformSchema, ReplaceFieldWithFragment } from 'graphql-tools';
import * as fastify from 'fastify';
import { ApolloServer } from 'apollo-server-fastify';

export async function createServer(
	conf: string | { basedir: string, configuration: Configuration }
) {
	const basedir = typeof conf === 'string' ? dirname(conf) : conf.basedir;
	const configuration = typeof conf === 'string' ? await loadConfiguration(conf) : conf.configuration;

	// Create initial context from configuration
	const context = await loadContext(configuration, basedir);

	// Load extension defined in configuration
	const extensions = await loadExtensions(configuration, basedir);

	// Load type definition from extensions
	const typeDefs = await loadTypeDef(configuration, context, extensions);

	// Create collection schema from type definition
	const collectionSchemas = await loadCollectionSchemas(typeDefs);

	// Create collections object from schemas
	context.collection = collectionSchemas.reduce((collections, schema) => {
		collections[schema.handle] = new Collection(
			context.database,
			configuration.locales ? Object.values(configuration.locales) : [],
			schema
		);
		return collections;
	}, {} as Context['collection']);

	const directives = await loadDirectives(configuration, context, extensions);

	// Load GraphQLSchema
	const graphQLSchema = await loadGraphQLSchema(
		typeDefs,
		await loadResolvers(configuration, context, extensions),
		directives
	);

	// Load mains function from extensions
	const mains = extensions.filter(extension => extension.main).map(extension => extension.main!);

	const app = fastify();
	for (const main of mains) {
		await main(app, configuration, context, extensions);
	}

	const apollo = new ApolloServer({
		schema: graphQLSchema,
		schemaDirectives: directives, // TODO : Still necessary, isn't baked into graphQLSchema already ?
		context({  }) {
			return {
				...context
			};
		},

		playground: true,
		tracing: true,
		cacheControl: true
	});

	app.register(apollo.createHandler());

	return {
		app,
		apollo,
		configuration,
		context,
		graphQLSchema
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

export async function loadContext(configuration: Configuration, basedir: string): Promise<Context> {
	const [database, filesystem, cache, mq] = await loadDrivers(configuration, basedir);

	return {
		database,
		filesystem,
		cache,
		mq,
		collection: {}
	};
}

export async function loadExtensions(configuration: Configuration, basedir: string): Promise<Extension[]> {
	const serviceResolvers = await Promise.all((configuration.extensions || []).map(path => resolveModule(path, basedir)));
	const extensions = serviceResolvers.map(path => require(path) as Extension);
	extensions.unshift(authExtension as any);
	extensions.unshift(baseExtension as any);
	return extensions;
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

export async function loadTypeDef(configuration: Configuration, context: Context, extensions: Extension[]): Promise<DocumentNode> {
	const typeDefs = await Promise.all(extensions.filter(extension => extension.typeDefs).map(extension => callCallable(extension.typeDefs!, configuration, context, extensions)));
	const documents = typeDefs.map(typeDef => typeof typeDef === 'string' ? parse(typeDef) : typeDef);
	return mergeAST(documents);
}

export async function loadCollectionSchemas(typeDef: DocumentNode): Promise<Schema[]> {
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
				handle: node.name.value,
				objects: (node.types || []).reduce((objects, type) => {
					const typeNode = getDefNodeByNamedType(typeDef, type.name.value) as ObjectTypeDefinitionNode;
					objects.push(mapObjectTypeDefinitionToObjectBase(typeNode));
					return objects;
				}, [] as ObjectBase[]),
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
	
	function mapFieldDefinitionToField(node: FieldDefinitionNode): Field | undefined {
		const directives = node.directives || [];
		const computed = directives.find(directive => directive.name.value === 'computed') !== undefined;
		if (computed) {
			return;
		}
		const multiple = isListType(node.type);
		const required = isNonNullType(node.type);
		const localized = directives.find(directive => directive.name.value === 'localized') !== undefined;
	
		return {
			required,
			localized,
			multiple,
			handle: node.name.value,
			type: mapTypeToFieldType(node.type),
			// size?: number;
		};
	}
	
	function mapTypeToFieldType(node: TypeNode): FieldType {
		if (node.kind === Kind.NON_NULL_TYPE || node.kind === Kind.LIST_TYPE) {
			return mapTypeToFieldType(node.type);
		}
	
		switch (node.name.value) {
			case 'ID':
			case 'String':
				return 'string';
			case 'Int':
				return 'int';
			case 'Float':
				return 'float';
			case 'Boolean':
				return 'boolean';
			case 'Date':
				return 'date';
			case 'DateTime':
				return 'datetime';
			default:
				const refNode = getDefNodeByNamedType(typeDef, node.name.value);
				if (refNode) {
					if (refNode.kind === Kind.ENUM_TYPE_DEFINITION) {
						return 'string';
					}
					else if (isCollection(refNode)) {
						return 'string';
					}
					else if (refNode.kind === Kind.OBJECT_TYPE_DEFINITION || refNode.kind === Kind.UNION_TYPE_DEFINITION) {
						return mapTypeDefinitionToSchema(refNode);
					}
				}
		}
		return 'string';
	}
}

export async function loadResolvers(configuration: Configuration, context: Context, extensions: Extension[]): Promise<IResolvers> {
	const resolvers = await Promise.all(extensions.filter(extension => extension.resolvers).map(extension => callCallable(extension.resolvers!, configuration, context, extensions)));
	return resolvers.reduce((resolvers, resolver) => {
		return {
			...resolvers,
			...resolver
		};
	}, {} as IResolvers);
}

export async function loadDirectives(configuration: Configuration, context: Context, extensions: Extension[]): Promise<Record<string, typeof SchemaDirectiveVisitor>> {
	const directives = await Promise.all(extensions.filter(extension => extension.directives).map(extension => callCallable(extension.directives!, configuration, context, extensions)));
	return directives.reduce((directives, directive) => {
		return {
			...directives,
			...directive
		};
	}, {} as Record<string, typeof SchemaDirectiveVisitor>);
}

export async function loadGraphQLSchema(typeDefs: DocumentNode, resolvers: IResolvers, directives: Record<string, typeof SchemaDirectiveVisitor>): Promise<GraphQLSchema> {
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