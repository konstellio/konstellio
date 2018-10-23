import { Database, q } from "@konstellio/db";
import { Locales } from "../../server";
import { Schema, Collection, IndexField } from "./types";

/**
 * Create Schema from Database
 */
export async function createSchemaFromDatabase(database: Database, locales: Locales): Promise<Schema> {
	const result = await database.execute(q.showCollection());
	const collections: Collection[] = [];

	for (const collection of result.collections) {
		const desc = await database.execute(q.describeCollection(collection));

		collections.push({
			handle: desc.collection.name,
			indexes: desc.indexes.map(index => ({
				handle: index.name,
				type: index.type,
				fields: index.columns.map(col => ({
					field: col!.field.name,
					direction: col!.direction
				})).toArray() as IndexField[]
			})),
			fields: desc.columns.map(col => ({
				handle: col.name,
				type: col.type,
				size: col.size
			}))
		});
	}

	return {
		collections
	};
}