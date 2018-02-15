import { PluginContext } from './interfaces';
import * as express from 'express';
import { Express } from '../../node_modules/@types/express-serve-static-core/index';

export async function createExpress(
    config: any
) {
    const app = express();
    app.disable('x-powered-by');

    // TODO authentification

    return app;
}