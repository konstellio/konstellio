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

	const User = models.get('User')! as Model<
		{ username: string, password: string },
		{ id: string, username: string, password: string }
	>;
	const Post = models.get('Post')! as Model<
		{ title: { fr: string, en: string }, slug: { fr: string, en: string }, postDate: Date, expireDate?: Date, author: string[], content: { fr: string, en: string } },
		{ id: string, title: string, slug: string, postDate: Date, expireDate: Date, author: string[], content: string }
	>;

	// const data = {
	// 	title: { fr: 'Premier post', en: 'First post' },
	// 	slug: { fr: 'premier-post', en: 'first-post' },
	// 	author: ['5a90c8373d116f05dca8fc5c'],
	// 	postDate: new Date(),
	// 	content: { fr: '...', en: '...' }
	// };
	// if (Post.validate(data)) {
	// 	const post = await Post.create(data);
	// }

	// const data = {
	// 	id: '5aa1d9965ab8cb158cbe5191',
	// 	title: { fr: 'Deuxième post', en: 'Second post' },
	// 	slug: { fr: 'deuxieme-post', en: 'second-post' },
	// 	author: ['5a90c8373d116f05dca8fc5c'],
	// 	postDate: new Date(),
	// 	content: { fr: '...', en: '...' }
	// }
	// if (Post.validate(data)) {
	// 	const post = await Post.replace(data);
	// }

	// const [a, b] = await Promise.all([
	// 	Post.findById('5aa1d9965ab8cb158cbe5191', { locale: 'fr', fields: ['id', 'title', 'author'] }),
	// 	Post.findById('5aa1d9965ab8cb158cbe5191', { locale: 'en', fields: ['postDate'] })
	// ]);

	// const p = await Post.find({ condition: q.eq('slug', 'premier-post'), locale: 'fr' });
	const p = await Post.findOne({ condition: q.eq('author', '5a90c8373d116f05dca8fc5c'), locale: 'fr' });

	// const errors = [];
	// const data = {
	// 	id: '...',
	// 	username: 'test',
	// 	password: '10'
	// };
	// if (User.validate(data, errors)) {
		
	// }

	debugger;
}