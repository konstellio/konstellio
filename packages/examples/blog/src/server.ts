import createServer from './generated/konstellio/createServer';

createServer()
	.then(({ app }) => app.listen(3000))
	.then(() => {
		console.log('Server listening at http://localhost:3000/');
	})
	.catch(err => {
		console.error(err);
		process.exit();
	});