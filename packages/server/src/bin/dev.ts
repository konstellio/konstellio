import { createServer } from 'http';
import { parseConfig } from '../lib/config';
import { loadPlugins, PluginContext } from '../lib/plugin';
import { createDatabase, createFilesystem, createCache, createMessageQueue } from '../lib/driver';
import { buildSchemaDocument, buildSchemaResolvers } from '../lib/schema';
import { buildModels } from '../lib/model';
import { dirname } from 'path';

export default async function ({ file }) {
	const config = await parseConfig(file);

	const [database, fs, cache, message] = await Promise.all([
		createDatabase(config.konstellio.database),
		createFilesystem(config.konstellio.fs),
		createCache(config.konstellio.cache),
		createMessageQueue(config.konstellio.mq)
	]);

	const context: PluginContext = {
		database,
		fs,
		cache,
		message
	}

	const plugins = await loadPlugins(context, dirname(file), config.konstellio.plugins);

	const graph = await buildSchemaDocument(plugins);
	const resolvers = await buildSchemaResolvers(plugins);
	const models = await buildModels(graph);

	// https://github.com/konstellio/konstellio/blob/b54e448222926bb58551d37b6bd25d6fb71cd8aa/src/lib/createGraphQL.ts
}