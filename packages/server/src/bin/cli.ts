import * as commander from 'commander';
import { join, isAbsolute, resolve } from 'path';
import { existsSync } from 'fs';
import dev from './dev';
import start from './start';

commander
	.command('dev')
	.description('Start server in development mode')
	.option(
		'-f, --file [file]', 'Path to the configuration file',
		(file) => isAbsolute(file) ? file : resolve(process.cwd(), file),
		join(process.cwd(), '.konstellio.yml')
	)
	.action(dev)
;

commander
	.command('start')
	.description('Start server')
	.option(
		'-f, --file [file]', 'Path to the configuration file',
		(file) => isAbsolute(file) ? file : resolve(process.cwd(), file),
		join(process.cwd(), '.konstellio.yml')
	)
	.action(start)
	;

commander.parse(process.argv);

if (commander.args.length < 1) {
	commander.help();
}