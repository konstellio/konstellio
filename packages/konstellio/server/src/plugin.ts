import { DocumentNode } from "graphql";
import { IResolvers } from "graphql-tools";
import { Server } from "./server";

export interface Plugin {
	identifier: string;
	dependencies?: string[];

	getTypeDef?: (server: Server) => string | Promise<string>;
	getTypeExtension?: (server: Server, document: DocumentNode) => string | Promise<string>;
	getResolvers?: (server: Server) => IResolvers | Promise<IResolvers>;
	getRoutes?: (server: Server) => Promise<any>;
	getTasks?: (server: Server) => Promise<any>;
}