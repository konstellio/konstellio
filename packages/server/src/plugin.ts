import { Server } from './server';
import { IResolvers } from 'graphql-tools/dist/Interfaces';
import { DocumentNode } from 'graphql';

export interface PluginConstructor {
	new(server: Server): Plugin;
}

export interface Plugin {
	isDisposed(): boolean;
	disposeAsync(): Promise<void>;

	getGraphQL?: () => Promise<string>;
	getGraphResolvers?: (ast: DocumentNode) => Promise<IResolvers>;
	getRoutes?: () => Promise<any>;
	getTasks?: () => Promise<any>;
}