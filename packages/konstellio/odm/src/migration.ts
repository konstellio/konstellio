import {
	Database,
	q,
	ColumnType,
	IndexType as DBIndexType,
	Index as DBIndex,
	QueryDropCollection,
	QueryCreateCollection,
	QueryAlterCollection,
	Transaction,
	Column,
} from '@konstellio/db';
import {
	Schema,
	Field,
	Index,
	IndexField,
	localizedFieldName,
	FieldType,
	IndexType,
	isUnion,
	Object,
	ObjectBase,
} from './schema';

function dbFieldTypeToSchemaFieldType(type: ColumnType): FieldType {
	switch (type) {
		case ColumnType.Boolean:
			return 'boolean';
		case ColumnType.Bit:
		case ColumnType.UInt:
		case ColumnType.Int:
			return 'int';
		case ColumnType.Float:
			return 'float';
		case ColumnType.Date:
			return 'date';
		case ColumnType.DateTime:
			return 'datetime';
		case ColumnType.Text:
		case ColumnType.Blob:
		default:
			return 'string';
	}
}

function dbIndexTypeToSchemaIndexType(type: DBIndexType): IndexType {
	switch (type) {
		case DBIndexType.Primary:
			return 'primary';
		case DBIndexType.Unique:
			return 'unique';
		case DBIndexType.Index:
		default:
			return 'sparse';
	}
}

export async function extractSchemaFromDatabase(database: Database): Promise<[Schema[], string[]]> {
	const schemas: Schema[] = [];
	const locales: string[] = [];

	const result = await database.execute(q.showCollection());
	for (const collection of result.collections) {
		const description = await database.execute(q.describeCollection(collection));

		schemas.push({
			handle: description.collection.name,
			fields: description.columns.reduce(
				(fields, column) => {
					const localizedMatch = localizedFieldName.exec(column.name);
					if (localizedMatch) {
						const handle = localizedMatch[1];
						const locale = localizedMatch[2];
						locales.includes(locale) || locales.push(locale);
						if (!fields.find(field => field.handle === handle)) {
							fields.push({
								handle,
								type: dbFieldTypeToSchemaFieldType(column.type),
								size: column.size,
								localized: true,
							});
						}
					} else {
						fields.push({
							handle: column.name,
							type: dbFieldTypeToSchemaFieldType(column.type),
							size: column.size,
							localized: false,
						});
					}
					return fields;
				},
				[] as Field[]
			),
			indexes: description.indexes.reduce(
				(indexes, index) => {
					const localizedMatch = localizedFieldName.exec(index.name);
					if (localizedMatch) {
						const handle = localizedMatch[1];
						const locale = localizedMatch[2];
						locales.includes(locale) || locales.push(locale);
						if (!indexes.find(index => index.handle === handle)) {
							const fields = index.columns.reduce(
								(fields, column) => {
									const localizedMatch = localizedFieldName.exec(column!.field.name as string);
									fields!.push({
										handle: (localizedMatch && localizedMatch[1]) || (column!.field.name as string),
										direction: column!.direction,
									});
									return fields!;
								},
								[] as IndexField[]
							);

							indexes.push({
								fields,
								handle,
								type: dbIndexTypeToSchemaIndexType(index.type),
							});
						}
					} else {
						indexes.push({
							handle: index.name,
							type: dbIndexTypeToSchemaIndexType(index.type),
							fields: index.columns.reduce(
								(fields, column) => {
									fields!.push({
										handle: column!.field.name as string,
										direction: column!.direction,
									});
									return fields!;
								},
								[] as IndexField[]
							),
						});
					}
					return indexes;
				},
				[] as Index[]
			),
		});
	}

	schemas.push(...(await extractDatabaseMandatorySchema(database)));

	return [schemas, locales];
}

export async function extractDatabaseMandatorySchema(database: Database): Promise<Schema[]> {
	const schemas: Schema[] = [];

	if (database.features.join) {
		schemas.push({
			handle: 'Relation',
			fields: [
				{ handle: 'id', type: 'string' },
				{ handle: 'collection', type: 'string' },
				{ handle: 'field', type: 'string' },
				{ handle: 'source', type: 'string' },
				{ handle: 'target', type: 'string' },
				{ handle: 'seq', type: 'int' },
			],
			indexes: [
				{ handle: 'Relation_pk', type: 'primary', fields: [{ handle: 'id' }] },
				{
					handle: 'Relation_collection_field_source',
					type: 'sparse',
					fields: [{ handle: 'collection' }, { handle: 'field' }, { handle: 'source' }, { handle: 'seq' }],
				},
			],
		});
	}

	return schemas;
}

export type Diff =
	| { action: 'add_collection'; collection: Schema }
	| { action: 'rename_collection'; collection: string; target: string }
	| { action: 'drop_collection'; collection: string }
	| { action: 'add_field'; collection: string; field: Field; copyFrom?: string }
	| { action: 'drop_field'; collection: string; field: string }
	| { action: 'alter_field'; collection: string; field: string; definition: Field }
	| { action: 'add_index'; collection: string; index: Index }
	| { action: 'alter_index'; collection: string; index: Index }
	| { action: 'drop_index'; collection: string; index: string }
	| { action: 'add_locale'; locale: string; copyFrom?: string }
	| { action: 'drop_locale'; locale: string };

export type FieldComparator = (fieldA: Field, fieldB: Field) => boolean;

export function computeSchemaDiff(source: Schema[], target: Schema[], comparator: FieldComparator): Diff[] {
	const diffs: Diff[] = [];

	for (const targetObject of target) {
		const sourceObject = source.find(object => object.handle === targetObject.handle);
		if (!sourceObject) {
			diffs.push({ action: 'add_collection', collection: targetObject });
		} else {
			for (const targetIndex of targetObject.indexes) {
				const sourceIndex = sourceObject.indexes.find(index => index.handle === targetIndex.handle);
				if (!sourceIndex) {
					diffs.push({ action: 'add_index', collection: targetObject.handle, index: targetIndex });
				} else {
					let alterIndex = targetIndex.type !== sourceIndex.type;

					if (!alterIndex) {
						for (const targetField of targetIndex.fields) {
							const sourceField = sourceIndex.fields.find(field => field.handle === targetField.handle);
							if (!sourceField || sourceField.direction !== targetField.direction) {
								alterIndex = true;
								break;
							}
						}
					}

					if (alterIndex) {
						diffs.push({ action: 'alter_index', collection: targetObject.handle, index: targetIndex });
					}
				}
			}

			for (const sourceIndex of sourceObject.indexes) {
				const targetIndex = targetObject.indexes.find(index => index.handle === sourceIndex.handle);
				if (!targetIndex) {
					diffs.push({ action: 'drop_index', collection: targetObject.handle, index: sourceIndex.handle });
				}
			}

			const targetFields = isUnion(targetObject)
				? targetObject.objects.reduce(reduceUniqueField, [] as Field[])
				: targetObject.fields;

			const sourceFields = isUnion(sourceObject)
				? sourceObject.objects.reduce(reduceUniqueField, [] as Field[])
				: sourceObject.fields;

			for (const targetField of targetFields) {
				const sourceField = sourceFields.find(field => field.handle === targetField.handle);
				if (!sourceField) {
					diffs.push({ action: 'add_field', collection: targetObject.handle, field: targetField });
				} else if (
					targetField.localized !== sourceField.localized ||
					// || targetField.multiple !== sourceField.multiple
					// || targetField.relation !== sourceField.relation
					// || targetField.inlined !== sourceField.inlined
					!comparator(targetField, sourceField)
				) {
					diffs.push({
						action: 'alter_field',
						collection: targetObject.handle,
						field: targetField.handle,
						definition: targetField,
					});
				}
			}

			for (const sourceField of sourceFields) {
				const targetField = targetFields.find(field => field.handle === sourceField.handle);
				if (!targetField) {
					diffs.push({ action: 'drop_field', collection: targetObject.handle, field: sourceField.handle });
				}
			}
		}
	}

	for (const sourceObject of source) {
		const targetObject = target.find(object => object.handle === sourceObject.handle);
		if (!targetObject) {
			diffs.push({ action: 'drop_collection', collection: sourceObject.handle });
		}
	}

	return diffs;
}

export function computeLocaleDiff(source: string[], target: string[]): Diff[] {
	const diffs: Diff[] = [];

	for (const locale of target) {
		if (!source.includes(locale)) {
			diffs.push({ locale, action: 'add_locale' });
		}
	}

	for (const locale of source) {
		if (!target.includes(locale)) {
			diffs.push({ locale, action: 'drop_locale' });
		}
	}

	return diffs;
}

function reduceUniqueField(fields: Field[], object: ObjectBase): typeof fields {
	for (const field of object.fields) {
		if (!fields.find(f => f.handle === field.handle)) {
			fields.push(field);
		}
	}
	return fields;
}

export function executeDiff(transaction: Transaction, schemas: Schema[], diffs: Diff[]): void {
	const dropCollections: QueryDropCollection[] = [];
	const createCollections: QueryCreateCollection[] = [];
	const alterCollections: Map<string, QueryAlterCollection> = new Map();

	const sortedDiffs = diffs.sort((a, b) => {
		if (
			a.action === 'drop_collection' ||
			a.action === 'drop_field' ||
			a.action === 'drop_index' ||
			a.action === 'drop_locale'
		) {
			return 1;
		}
		return 0;
	});

	function ensureAlterIsInMap(collection: string) {
		if (!alterCollections.has(collection)) {
			alterCollections.set(collection, q.alterCollection(collection));
		}
	}

	for (const diff of sortedDiffs) {
		switch (diff.action) {
			case 'add_collection':
				const fields = reduceSchemaFields(diff.collection);
				const columns = fields.map(mapSchemaFieldToDbColumn);
				const indexes = diff.collection.indexes.map(mapSchemaIndexToDbIndex);
				createCollections.push(q.createCollection(diff.collection.handle).define(columns, indexes));
				break;
			case 'rename_collection':
				if (!alterCollections.has(diff.collection)) {
					alterCollections.set(diff.collection, q.alterCollection(diff.collection));
				}
				alterCollections.set(diff.collection, alterCollections.get(diff.collection)!.rename(diff.target));
				break;
			case 'drop_collection':
				dropCollections.push(q.dropCollection(diff.collection));
				break;
			case 'add_locale':
				for (const schema of schemas) {
					const fields = reduceSchemaFields(schema);
					for (const field of fields) {
						if (field.localized) {
							ensureAlterIsInMap(schema.handle);

							const newColumn = mapSchemaFieldToDbColumn({
								...field,
								handle: `${field.handle}__${diff.locale}`,
							});
							alterCollections.set(
								schema.handle,
								alterCollections.get(schema.handle)!.addColumn(newColumn, diff.copyFrom)
							);
						}
					}
				}
				break;
			case 'drop_locale':
				for (const schema of schemas) {
					const fields = reduceSchemaFields(schema);
					for (const field of fields) {
						if (field.localized) {
							ensureAlterIsInMap(schema.handle);

							alterCollections.set(
								schema.handle,
								alterCollections.get(schema.handle)!.dropColumn(`${field.handle}__${diff.locale}`)
							);
						}
					}
				}
				break;
				break;
			default:
				ensureAlterIsInMap(diff.collection);

				switch (diff.action) {
					case 'add_field':
						const newColumn = mapSchemaFieldToDbColumn(diff.field);
						alterCollections.set(
							diff.collection,
							alterCollections.get(diff.collection)!.addColumn(newColumn, diff.copyFrom)
						);
						break;
					case 'alter_field':
						const alteredColumn = mapSchemaFieldToDbColumn(diff.definition);
						alterCollections.set(
							diff.collection,
							alterCollections.get(diff.collection)!.alterColumn(diff.field, alteredColumn)
						);
						break;
					case 'drop_field':
						alterCollections.set(
							diff.collection,
							alterCollections.get(diff.collection)!.dropColumn(diff.field)
						);
						break;
					case 'add_index':
						const newIndex = mapSchemaIndexToDbIndex(diff.index);
						alterCollections.set(
							diff.collection,
							alterCollections.get(diff.collection)!.addIndex(newIndex)
						);
						break;
					case 'alter_index':
						const alteredIndex = mapSchemaIndexToDbIndex(diff.index);
						alterCollections.set(
							diff.collection,
							alterCollections
								.get(diff.collection)!
								.dropIndex(diff.index.handle)
								.addIndex(alteredIndex)
						);
						break;
					case 'drop_index':
						alterCollections.set(
							diff.collection,
							alterCollections.get(diff.collection)!.dropIndex(diff.index)
						);
						break;
				}
		}
	}

	dropCollections.forEach(query => transaction.execute(query));
	createCollections.forEach(query => transaction.execute(query));
	alterCollections.forEach(query => transaction.execute(query));
}

function reduceSchemaFields(schema: Schema): Field[] {
	return isUnion(schema)
		? schema.objects.reduce(
				(fields, object) => {
					for (const field of object.fields) {
						if (!fields.find(f => f.handle === field.handle)) {
							fields.push(field);
						}
					}
					return fields;
				},
				[] as Field[]
		  )
		: schema.fields;
}

function mapSchemaColumnTypeToDbColumnType(type: FieldType): ColumnType {
	switch (type) {
		case 'int':
			return ColumnType.Int;
		case 'float':
			return ColumnType.Float;
		case 'boolean':
			return ColumnType.Boolean;
		case 'date':
			return ColumnType.Date;
		case 'datetime':
			return ColumnType.DateTime;
		case 'string':
		default:
			return ColumnType.Text;
	}
}

function mapSchemaFieldToDbColumn(field: Field): Column {
	return q.column(field.handle, mapSchemaColumnTypeToDbColumnType(field.type), field.size);
}

function mapSchemaIndexTypeToDbIndexType(type: IndexType): DBIndexType {
	switch (type) {
		case 'primary':
			return DBIndexType.Primary;
		case 'unique':
			return DBIndexType.Unique;
		case 'sparse':
		default:
			return DBIndexType.Index;
	}
}

function mapSchemaIndexToDbIndex(index: Index): DBIndex {
	const columns = index.fields.map(field => q.sort(field.handle, field.direction));
	return q.index(index.handle, mapSchemaIndexTypeToDbIndexType(index.type), columns);
}
