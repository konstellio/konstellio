import { Plugin, IResolvers } from './plugin';
import { parse } from 'graphql/language/parser';
import { DocumentNode } from 'graphql';

export async function buildSchemaDocument(plugins: Plugin[]): Promise<DocumentNode> {
	const schema = plugins.map<string>(plugin => plugin.graphql || '').join(`\n`);
	return parse(schema, { noLocation: true });
}

export async function buildSchemaResolvers(plugins: Plugin[]): Promise<IResolvers> {
	return plugins.reduce((resolvers, plugin) => {
		Object.keys(plugin.resolvers || {}).forEach(key => {
			resolvers[key] = resolvers[key] || {};
			Object.assign(resolvers[key], plugin.resolvers![key]);
		});
		return resolvers;
	}, {} as IResolvers);
}