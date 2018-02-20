import { createServer } from 'http';
import { parseConfig } from '../utils/config';
import { loadPlugins, PluginInitContext } from '../utils/plugin';
import { createDatabase, createFilesystem, createCache, createMessageQueue } from '../utils/driver';
import { getSchemaDocument, getSchemaResolvers, parseSchema } from '../utils/schema';
import { dirname } from 'path';
import { getSchemaDiff, executeSchemaMigration } from '../utils/model';
import { ReadStream, WriteStream } from 'tty';

export default async function ({ file }) {
	const config = await parseConfig(file);

	const locales = config.konstellio.locales || { 'en': 'English' };

	const [database, fs, cache, message] = await Promise.all([
		createDatabase(config.konstellio.database),
		createFilesystem(config.konstellio.fs),
		createCache(config.konstellio.cache),
		createMessageQueue(config.konstellio.mq)
	]);

	const context: PluginInitContext = {
		locales,
		database,
		fs,
		cache,
		message
	}

	const plugins = await loadPlugins(context, dirname(file), config.konstellio.plugins);
	const graph = await getSchemaDocument(context, plugins);
	const schemas = parseSchema(graph);
	const diffs = await getSchemaDiff(context, schemas);

	if (diffs.length > 0) {
		if (!!process.stdout.isTTY) {
			console.log('Attempting schema migration.');
			try {
				await executeSchemaMigration(context, diffs, process.stdin as ReadStream, process.stdout as WriteStream);
			} catch (err) {
				console.error(`Could not complete schema migration : ${err.stack}`);
				process.exit();
			} finally {
				console.log('Migration completed.');
			}
		} else {
			console.error(`Migration needs an interactive terminal.`);
			process.exit();
		}
	}

	debugger;

	// const resolvers = await buildSchemaResolvers(plugins);

	// https://github.com/konstellio/konstellio/blob/b54e448222926bb58551d37b6bd25d6fb71cd8aa/src/lib/createGraphQL.ts
}