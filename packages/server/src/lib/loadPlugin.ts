import { Express } from '../../node_modules/@types/express-serve-static-core/index';
import { Config } from '..';
import { PluginContext, Plugin } from './interfaces';
import { join } from 'path';
import { defaultPlugin } from './defaultPlugin';


export async function loadPlugin(
    dir: string,
    config: Config,
    app: Express,
    context: PluginContext
) {
    // Add project to package search path when requiring modules
	(require.main as any).paths.push(join(dir, 'node_modules'));

    const plugins: Plugin[] = await Promise.all([defaultPlugin(context)].concat(
        config.sculptor.plugins
            ? config.sculptor.plugins.map<Promise<Plugin>>(name => new Promise<Plugin>((resolve, reject) => {
                return Promise.resolve<Plugin>(require(name)(context));
            }))
            : []
    ));

    console.log(plugins);
    
}