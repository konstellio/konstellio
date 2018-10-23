import { Database } from "@konstellio/db";
import { Locales } from "../../server";
import { DocumentNode, Kind } from "graphql";
import { getValue, isCollection } from "../utilities/ast";
import { Collection, Structure } from "../../collection";

/**
 * Create type extension for each collections
 */
export function createTypeExtensionsFromDefinitions(ast: DocumentNode, locales: Locales): string {
	return ast.definitions.reduce((extensions, node) => {
		if ((node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.UNION_TYPE_DEFINITION) && isCollection(node)) {
			const collection = (node.directives || []).find(directive => directive.name.value === 'collection')!;
			const type = (collection.arguments || []).reduce((type, arg) => {
				if (arg.name.value === 'type') {
					return getValue(arg.value);
				}
				return type;
			}, 'collection');

			// @ts-ignore
			const collectionClass = {
				collection: Collection,
				structure: Structure
			}[type] as typeof Collection;

			const extension = collectionClass.createTypeExtension(ast, node);
			if (extension) {
				extensions.push(extension);
			}
		}
		return extensions;
	}, [] as string[]).join(`\n`);
}

/**
 * Create type extension from database driver
 */
export function createTypeExtensionsFromDatabaseDriver(driver: Database, locales: Locales): string {
	if (driver.features.join) {
		return `
			type Relation
			@collection(
				indexes: [
					{ handle: "Relation_collection", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "collection", direction: "asc" }] },
					{ handle: "Relation_field", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "collection", direction: "asc" }, { field: "field", direction: "asc" }] },
					{ handle: "Relation_source", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "source", direction: "asc" }, { field: "seq", direction: "asc" }] },
					{ handle: "Relation_target", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "target", direction: "asc" }] }
				]
			)
			{
				id: ID!
				collection: String!
				field: String!
				source: ID!
				target: ID!
				seq: String!
			}
		`;
	}
	return '';
}