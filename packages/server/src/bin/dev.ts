import { createServer } from 'http';
import { parseConfig } from '../utils/config';
import { loadPlugins, PluginInitContext } from '../utils/plugin';
import { createDatabase, createFilesystem, createCache, createMessageQueue } from '../utils/driver';
import { getSchemaDocument, getSchemaResolvers, parseSchema } from '../utils/schema';
import { dirname } from 'path';
import { getSchemaDiff, executeSchemaMigration } from '../utils/migration';
import { ReadStream, WriteStream } from 'tty';
import { getModels, Model } from '../utils/model';
import { q } from '@konstellio/db';

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

	const models = await getModels(context, schemas, Object.keys(locales));

	const User = models.get('User')!;
	const Post = models.get('Post')!;

	// const u = await User.create({ username: 'lpaudet', password: 'bleh' });
	// const u = await User.findOne({ condition: q.eq('id', '5a90c8373d116f05dca8fc5c') });
	// const u = await User.findById('5a90c8373d116f05dca8fc5c');
	// console.log(JSON.stringify(u));

	// const us = await User.findByIds(['5a90c8373d116f05dca8fc5c', '5a91ab4b52ff84191c1ae33c'], { fields: ['username'] });
	// const us = await Promise.all([
	// 	User.findById('5a90c8373d116f05dca8fc5c'),
	// 	User.findById('5a90c8373d116f05dca8fc5c', { fields: ['username'] }),
	// 	User.findById('5a91ab4b52ff84191c1ae33c', { fields: ['id'] })
	// ])
	// const us = await User.find();

	// const pid = await Post.create({
	// 	title: { fr: 'Premier post', en: 'First post' },
	// 	slug: { fr: 'premier-post', en: 'first-post' },
	// 	author: ['5a90c8373d116f05dca8fc5c'],
	// 	postDate: new Date(),
	// 	content: { fr: '...', en: '...' }
	// });

	// const p = await Post.findById('5a959dda04eaf84f40e5592a', { locale: 'fr' });
	// const as = await Post.relation(p.id, 'author', { locale: 'fr', fields: ['username'] });

	const p = await Post.find({ condition: q.eq('slug', 'premier-post'), locale: 'fr' });

	debugger;
}