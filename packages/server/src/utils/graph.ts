import { DocumentNode } from 'graphql';
import { IResolvers } from 'graphql-tools/dist/Interfaces';
import { Record } from './record';
import { Schema, FieldRelation } from './schema';
import { isArray } from 'util';
import { Locales } from './config';

export async function getResolvers(locales: Locales, pluginResolvers: IResolvers[], schemas: Schema[]): Promise<IResolvers> {
	const localeCodes = Object.keys(locales);
	const defaultLocale = localeCodes[0];

	const resolvers: IResolvers = {};

	schemas.forEach(schema => {
		schema.fields
		.filter(field => field.type === 'relation' && 'model' in field)
		.forEach((field: FieldRelation) => {
			resolvers[schema.handle] = Object.assign({}, resolvers[schema.handle], {
				async [field.handle](parent, { }, { records }, info) {
					const selection = getSelectionFromInfo(info);
					const locale = getLocaleFromQuery(info);

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

	return pluginResolvers.reduce((resolvers, resolver) => {
		for (let key in resolver) {
			resolvers[key] = Object.assign({}, resolvers[key], resolver[key]);
		}
		return resolvers;
	}, resolvers);
}

export function getSelectionFromInfo(info: any): string[] {
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