import * as commander from 'commander';
import { join, isAbsolute, resolve } from 'path';
import { existsSync } from 'fs';
import dev from './dev';

commander
	.command('dev')
	.description('Start server in development mode')
	.option(
		'-f, --file [file]', 'Path to the configuration file',
		(file) => isAbsolute(file) ? file : resolve(process.cwd(), file),
		join(process.cwd(), '.sculptor.yml')
	)
	.action(dev)
;

commander.parse(process.argv);

if (commander.args.length < 1) {
	commander.help();
}