import * as commander from 'commander';
import * as path from 'path';
import generate from './lib/generate';
const { version } = require('../package.json');

commander.version(version);

commander
	.command('init')
	.description('Initialize Konstellio service')
	.option('-l, --location [location]', 'Project location')
	.action((options) => {
		console.log('init', options);
	});

commander
	.command('watch')
	.description('Watch for changes in configuration or extensions and generate type definition')
	.action((options) => {
		console.log('watching...', options);
	});

commander
	.command('generate')
	.description('Generate type definition')
	.option('-c, --config [config]', 'Configuration file location', './konstellio.yml')
	.action(async (options) => {
		try {
			await generate(path.resolve(options.config));
		} catch (err) {
			console.error('err', err);
		}
	});

commander
	.command('migrate')
	.description('Run migration wizard')
	.option('-c, --config [config]', 'Configuration file location', './konstellio.yml')
	.action(async (options) => {
		try {
			console.log('migrating...', options);
		} catch (err) {
			console.error('err', err);
		}
	});

commander.parse(process.argv);