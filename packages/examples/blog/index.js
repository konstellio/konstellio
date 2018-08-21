const { createServer } = require('@konstellio/server');
const { join } = require('path');

(async () => {

	const server = await createServer({
		locales: {
			en: 'English',
			fr: 'French'
		},
		database: {
			driver: 'sqlite',
			filename: join(__dirname, 'blog.sqlite')
		}
	});

	server.register(require('./blog.js'));

	const status = await server.listen();
	console.log(`Server listening to http://${status.address}:${status.port}/`);

})().catch(err => console.error(err.stack));