import {
	loadConfiguration,
	loadContext,
	loadExtensions,
	loadTypeDefs,
	loadCollectionSchemas,
} from '@konstellio/server';
import { dirname, join } from 'path';
import {
	extractSchemaFromDatabase,
	computeSchemaDiff,
	computeLocaleDiff,
	extractDatabaseMandatorySchema,
	Diff,
	executeDiff,
} from '@konstellio/odm';
import * as inquirer from 'inquirer';

export default async function(configurationLocation: string) {
	const configuration = await loadConfiguration(configurationLocation);
	const basedir = dirname(configurationLocation);
	const context = await loadContext(configuration, basedir);
	const extensions = await loadExtensions(configuration, basedir, context);
	const typeDefs = loadTypeDefs(extensions);

	const typeDefsSchemas = loadCollectionSchemas(typeDefs);
	typeDefsSchemas.push(...(await extractDatabaseMandatorySchema(context.database)));

	const [dbSchemas, dbLocales] = await extractSchemaFromDatabase(context.database);

	debugger;
	// TODO : context.database.features.join discard relation in typeDefsSchemas ?

	const diffs = [
		// ...computeSchemaDiff(dbSchemas, typeDefsSchemas, (a, b) => a.type === b.type && a.size === b.size),
		...computeSchemaDiff(dbSchemas, typeDefsSchemas, (a, b) => a.type === b.type),
		...computeLocaleDiff(dbLocales, Object.keys(configuration.locales || {})),
	];

	const confirmedDiffs = await promptSchemaDiff(diffs);

	debugger;

	const transaction = await context.database.transaction();
	await executeDiff(transaction, typeDefsSchemas, confirmedDiffs);
	await transaction.commit();
}

async function promptSchemaDiff(diffs: Diff[]): Promise<Diff[]> {
	const sortedDiffs = diffs.sort((a, b) => {
		if (
			a.action === 'drop_collection' ||
			a.action === 'drop_field' ||
			a.action === 'drop_index' ||
			a.action === 'drop_locale'
		) {
			return -1;
		}
		return 0;
	});
	const newDiffs: Diff[] = [];

	for (const diff of sortedDiffs) {
		// TODO : https://github.com/konstellio/konstellio/blob/master/packages/konstellio/server/src/utilities/migration.ts
		switch (diff.action) {
			case 'drop_collection':
			case 'drop_field':
			case 'drop_locale':
				debugger;
				break;
			default:
				newDiffs.push(diff);
				break;
		}
	}

	return newDiffs;
}
