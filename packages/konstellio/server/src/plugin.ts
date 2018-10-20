import { DocumentNode } from "graphql";
import { IResolvers, SchemaDirectiveVisitor } from "graphql-tools";
import { Server, Request, Response } from "./server";

export interface Plugin {
	identifier: string;
	dependencies?: string[];

	getTypeDef?: (server: Server) => string | Promise<string>;
	getTypeExtension?: (server: Server, document: DocumentNode) => string | Promise<string>;
	getResolvers?: (server: Server) => IResolvers | Promise<IResolvers>;
	getDirectives?: (server: Server) => Promise<Record<string, typeof SchemaDirectiveVisitor>>;
	setupRoutes?: (server: Server) => Promise<void>;
	setupContext?: (server: Server, request: Request, response: Response) => Promise<any>;
	setupTasks?: (server: Server) => Promise<void>;
}