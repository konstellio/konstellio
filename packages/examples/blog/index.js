// @ts-check
const { createServer } = require('@konstellio/server');
const { FileSystemLocal } = require('@konstellio/fs-local');
const { DatabaseSQLite } = require('@konstellio/db-sqlite');
const { CacheMemory } = require('@konstellio/cache-memory');
const { MessageQueueMemory } = require('@konstellio/mq-memory');
const { join } = require('path');

(async () => {

	const server = await createServer({
		locales: {
			en: 'English',
			fr: 'French'
		},
		fs: new FileSystemLocal(join(__dirname, 'public')),
		db: new DatabaseSQLite({
			filename: join(__dirname, 'blog.sqlite')
		}),
		cache: new CacheMemory(),
		mq: new MessageQueueMemory()
	});

	server.register(require('@konstellio/plugin-user').default);
	server.register(require('./blog.js'));

	const status = await server.listen();
	console.log(`Server listening to http://${status.address}:${status.port}/`);

})().catch(err => console.error(err.stack));