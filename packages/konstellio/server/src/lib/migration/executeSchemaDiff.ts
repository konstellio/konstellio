import { SchemaDiff } from "./types";
import { Database, QueryDropCollection, QueryCreateCollection, QueryAlterCollection, Column, Index, q, FieldDirection } from "@konstellio/db";

/**
 * Execute schema diff
 */
export async function executeSchemaDiff(diffs: SchemaDiff[], database: Database): Promise<void> {

	diffs = diffs.sort((a, b) => {
		if (a.action === 'drop_collection' || a.action === 'drop_field' || a.action === 'drop_index') {
			return 1;
		}
		return 0;
	});

	const dropCollections: QueryDropCollection[] = [];
	const createCollections: QueryCreateCollection[] = [];
	const alterCollections: Map<string, QueryAlterCollection> = new Map();

	for (const diff of diffs) {
		if (diff.action === 'add_collection') {
			const columns = diff.collection.fields
				.map<Column>(field => {
					return q.column(field.handle, field.type, field.size);
				});

			const indexes = diff.collection.indexes
				.map<Index>(index => {
					const columns = index.fields.map(field => {
						return q.sort(q.field(field.field), field.direction || 'asc');
					});
					return q.index(index.handle, index.type, columns);
				});
			
			createCollections.push(q.createCollection(diff.collection.handle).define(columns, indexes));
		}

		else if (diff.action === 'rename_collection') {
			if (!alterCollections.has(diff.renamedFrom)) {
				alterCollections.set(diff.renamedFrom, q.alterCollection(diff.renamedFrom));
			}

			alterCollections.set(
				diff.renamedFrom,
				alterCollections.get(diff.renamedFrom)!.rename(diff.collection.handle)
			);
		}

		else if (diff.action === 'drop_collection') {
			dropCollections.push(q.dropCollection(diff.collection.handle));
		}

		else {
			if (!alterCollections.has(diff.collection.handle)) {
				alterCollections.set(diff.collection.handle, q.alterCollection(diff.collection.handle));
			}

			if (diff.action === 'add_field') {
				alterCollections.set(
					diff.collection.handle,
					alterCollections.get(diff.collection.handle)!.addColumn(q.column(diff.field.handle, diff.field.type, diff.field.size), diff.renamedTo)
				);
			}
			else if (diff.action === 'alter_field') {
				alterCollections.set(
					diff.collection.handle,
					alterCollections.get(diff.collection.handle)!.alterColumn(diff.field.handle, q.column(diff.field.handle, diff.field.type, diff.field.size))
				);
			}
			else if (diff.action === 'drop_field') {
				alterCollections.set(
					diff.collection.handle,
					alterCollections.get(diff.collection.handle)!.dropColumn(diff.field.handle)
				);
			}
			else if (diff.action === 'add_index') {
				const columns = diff.index.fields.map<FieldDirection>(field => q.sort(q.field(field.field), field.direction));

				alterCollections.set(
					diff.collection.handle,
					alterCollections.get(diff.collection.handle)!.addIndex(q.index(diff.index.handle, diff.index.type, columns))
				);
			}
			else if (diff.action === 'alter_index') {
				const columns = diff.index.fields.map<FieldDirection>(field => q.sort(q.field(field.field), field.direction));
				alterCollections.set(
					diff.collection.handle,
					alterCollections.get(diff.collection.handle)!
						.dropIndex(diff.index.handle)
						.addIndex(q.index(diff.index.handle, diff.index.type, columns))
				);
			}
			else if (diff.action === 'drop_index') {
				alterCollections.set(
					diff.collection.handle,
					alterCollections.get(diff.collection.handle)!.dropIndex(diff.index.handle)
				);
			}
		}
	}

	const transaction = await database.transaction();

	dropCollections.forEach(query => transaction.execute(query));
	createCollections.forEach(query => transaction.execute(query));
	alterCollections.forEach(query => transaction.execute(query));

	await transaction.commit();
}