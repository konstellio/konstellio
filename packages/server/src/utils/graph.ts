import * as express from 'express';
import { Express } from '../../node_modules/@types/express-serve-static-core/index';
import { PluginInitContext, Plugin } from "./plugin";
import { DocumentNode } from 'graphql';
import { IResolvers } from 'graphql-tools/dist/Interfaces';
import * as bodyParser from 'body-parser';
import playgroundExpress from 'graphql-playground-middleware-express';
import { graphqlExpress } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { Record } from './record';
import { Schema, FieldRelation } from './schema';
import { q } from '@konstellio/db';
import { isArray } from 'util';

export function getSelectionFromInfo (info: any): string[] {
	return info.fieldNodes.reduce((fields, fieldNode) => {
		fieldNode.selectionSet.selections.forEach(selection => {
			fields.push(selection.name.value);
		});
		return fields;
	}, [] as string[]);
}

export function getLocaleFromQuery(info: any): string {
	return info.operation.selectionSet.selections[0].arguments.reduce((locale, arg) => {
		if (arg.name.value === 'locale') {
			return arg.value.value;
		}
		return locale;
	}, '');
}

export async function getResolvers(context: PluginInitContext, plugins: Plugin[], schemas: Schema[]): Promise<IResolvers> {
	const resolvers: IResolvers = {};

	schemas.forEach(schema => {
		schema.fields
		.filter(field => field.type === 'relation' && 'model' in field)
		.forEach((field: FieldRelation) => {
			resolvers[schema.handle] = Object.assign({}, resolvers[schema.handle], {
				async [field.handle](parent, { }, { records }, info) {
					const selection = getSelectionFromInfo(info);
					const locale = getLocaleFromQuery(info);
					const defaultLocale = Object.keys(context.locales)[0];

					const target: Record = records.get(field.schema)!;
					const ids: string[] = typeof parent[field.handle] !== 'undefined' && isArray(parent[field.handle]) ? parent[field.handle] : [];
					const results = await target.findByIds(ids, {
						locale: locale || defaultLocale,
						fields: selection
					});

					if (field.multiple) {
						return results;
					}
					return results[0];
				}
			});
		})
	});

	const pluginResolvers = await Promise.all(plugins.map<Promise<IResolvers>>(plugin => plugin && plugin.resolvers ? plugin.resolvers() : Promise.resolve({} as IResolvers)));

	return pluginResolvers.reduce((resolvers, resolver) => {
		for (let key in resolver) {
			resolvers[key] = Object.assign({}, resolvers[key], resolver[key]);
		}
		return resolvers;
	}, resolvers);
}

export async function getGraphServer(
	context: PluginInitContext,
	graph: DocumentNode,
	resolvers: IResolvers,
	records: Map<string, Record>
): Promise<Express> {

	const app = express();

	app.use(
		'/playground',
		playgroundExpress({
			endpoint: '/graphql'
		})
	);

	app.use(
		'/graphql',
		bodyParser.urlencoded({ extended: true }),
		bodyParser.json(),
		graphqlExpress((req) => {

			const schema = makeExecutableSchema({
				typeDefs: graph,
				resolvers,
				resolverValidationOptions: {
					allowResolversNotInSchema: true
				}
			});

			// Object.assign(context, { req }, context);
			return {
				schema,
				context: Object.assign({}, context, {
					q,
					req,
					records
				})
			};
		})
	);


	return app;
}