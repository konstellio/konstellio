import { Schema, compareTypes, SchemaDiff } from "./types";
import { Compare } from "@konstellio/db";

/**
 * Compute schema differences
 */
export function computeSchemaDiff(source: Schema, target: Schema, compareTypes: compareTypes): SchemaDiff[] {
	const diffs: SchemaDiff[] = [];

	for (const targetCollection of target.collections) {
		const sourceCollection = source.collections.find(collection => collection.handle === targetCollection.handle);
		if (sourceCollection === undefined) {
			diffs.push({ action: 'add_collection', collection: targetCollection, sourceSchema: source });
		}
		else {
			for (const targetIndex of targetCollection.indexes) {
				const sourceIndex = sourceCollection.indexes.find(index => index.handle === targetIndex.handle);
				if (sourceIndex === undefined) {
					diffs.push({ action: 'add_index', collection: targetCollection, index: targetIndex });
				}
				else {
					let alterIndex = targetIndex.type !== sourceIndex.type;

					if (!alterIndex) {
						for (const targetField of targetIndex.fields) {
							const sourceField = sourceIndex.fields.find(field => field.field === targetField.field);
							if (sourceField === undefined || sourceField.direction !== targetField.direction) {
								alterIndex = true;
								break;
							}
						}
					}

					if (alterIndex) {
						diffs.push({ action: 'alter_index', collection: targetCollection, index: targetIndex });
					}
				}
			}

			for (const sourceIndex of sourceCollection.indexes) {
				const targetIndex = targetCollection.indexes.find(index => index.handle === sourceIndex.handle);
				if (targetIndex === undefined) {
					diffs.push({ action: 'drop_index', collection: targetCollection, index: sourceIndex });
				}
			}

			for (const targetField of targetCollection.fields) {
				const sourceField = sourceCollection.fields.find(field => field.handle === targetField.handle);
				if (sourceField === undefined) {
					diffs.push({ sourceCollection, action: 'add_field', collection: targetCollection, field: targetField });
				}
				else if ((compareTypes(sourceField.type, sourceField.size || -1, targetField.type, targetField.size || -1) & Compare.Castable) === 0) {
					diffs.push({ sourceCollection, action: 'alter_field', collection: targetCollection, field: targetField });
				}
			}

			for (const sourceField of sourceCollection.fields) {
				const targetField = targetCollection.fields.find(index => index.handle === sourceField.handle);
				if (targetField === undefined) {
					diffs.push({ action: 'drop_field', collection: targetCollection, field: sourceField });
				}
			}
		}
	}

	for (const sourceCollection of source.collections) {
		const targetCollection = target.collections.find(collection => collection.handle === sourceCollection.handle);
		if (targetCollection === undefined) {
			diffs.push({ action: 'drop_collection', collection: sourceCollection });
		}
	}

	return diffs;
}