import { createServer } from 'http';
import { parseConfig } from '../utils/config';
import { loadPlugins, PluginInitContext } from '../utils/plugin';
import { createDatabase, createFilesystem, createCache, createMessageQueue } from '../utils/driver';
import { getSchemaDocument, getSchemaResolvers, parseSchema } from '../utils/schema';
import { dirname } from 'path';
import { getSchemaDiff, executeSchemaMigration } from '../utils/migration';
import { ReadStream, WriteStream } from 'tty';
import { getRecords, Record } from '../utils/record';
import { getGraphServer, getResolvers } from '../utils/graph';

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

	const records = await getRecords(context, schemas, Object.keys(locales));


	const resolvers = await getResolvers(context, plugins, schemas);
	const graphServer = await getGraphServer(context, graph, resolvers, records);

	const server = createServer(graphServer);
	server.listen(
		config.konstellio.server && config.konstellio.server.port || 8080,
		config.konstellio.server && config.konstellio.server.host || 'localhost',
		() => {
			const addr = server.address();
			console.log(`Server is now running on http://${addr.address}:${addr.port}`);
		}
	);
}