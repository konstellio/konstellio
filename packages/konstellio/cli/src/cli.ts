import * as commander from 'commander';
import * as path from 'path';
import { parseServiceFromFile } from './lib/parseConfiguration';
import { generate } from './lib/generate';
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
	.command('dev')
	.description('Run development service')
	.action((options) => {
		console.log('init', options);
	});

commander
	.command('generate')
	.description('Generate Konstellio service')
	.option('-c, --config [config]', 'Configuration file location', './konstellio.yml')
	.action(async (options) => {
		try {
			const configLocation = path.resolve(options.config);
			const serviceLocation = path.dirname(configLocation);
			const service = await parseServiceFromFile(configLocation, serviceLocation);
			await generate(service);
		} catch (err) {
			console.error('err', err);
		}
	});

commander.parse(process.argv);