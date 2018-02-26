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

	type User = {
		username: string
	}
	type UserInput = {
		username: string
		password: string
	}

	type Post = {
		title: string
		slug: string
		postDate: Date
		expireDate?: Date
		content: string
	}
	type PostInput = {
		title: {
			fr: string
			en: string
		}
		slug: {
			fr: string
			en: string
		}
		postDate: Date
		expireDate?: Date
		content: {
			fr: string
			en: string
		}
	}

	const user = models.get('User')! as Model<User, UserInput>;
	const post = models.get('Post')! as Model<Post, PostInput>;

	// const u = await user.create({ username: 'lpaudet', password: 'bleh' });
	// const u = await user.findOne({ condition: q.eq('id', '5a90c8373d116f05dca8fc5c') });
	// const u = await user.findById('5a90c8373d116f05dca8fc5c');
	// console.log(JSON.stringify(u));

	// const us = await user.findByIds(['5a90c8373d116f05dca8fc5c', '5a91ab4b52ff84191c1ae33c'], { fields: ['username'] });
	// const us = await Promise.all([
	// 	user.findById('5a90c8373d116f05dca8fc5c'),
	// 	user.findById('5a90c8373d116f05dca8fc5c', { fields: ['username'] }),
	// 	user.findById('5a91ab4b52ff84191c1ae33c', { fields: ['id'] })
	// ])
	// const us = await user.find();

	// const p = await post.create({
	// 	title: { fr: 'Premier post', en: 'First post' },
	// 	slug: { fr: 'premier-post', en: 'first-post' },
	// 	postDate: new Date(),
	// 	content: { fr: '...', en: '...' }
	// });

	const ps = await post.find({ locale: 'fr' });

	debugger;
}