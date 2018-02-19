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

	const [database, fs, cache, message] = await Promise.all([
		createDatabase(config.konstellio.database),
		createFilesystem(config.konstellio.fs),
		createCache(config.konstellio.cache),
		createMessageQueue(config.konstellio.mq)
	]);

	const context: PluginInitContext = {
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
		console.error(`Schema differ from database. Please use \`dev\` command to run through migration steps.`);
		process.exit();
	}

	debugger;
}