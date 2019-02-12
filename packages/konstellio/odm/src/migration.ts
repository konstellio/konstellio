import { Database, q, ColumnType, IndexType as DBIndexType } from "@konstellio/db";
import { Schema, Field, Index, IndexField, localizedFieldName, FieldType, IndexType } from "./schema";

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

export async function extractSchemaFromDatabase(database: Database): Promise<Schema[]> {
	const schemas: Schema[] = [];

	const result = await database.execute(q.showCollection());
	for (const collection of result.collections) {
		const description = await database.execute(q.describeCollection(collection));

		schemas.push({
			handle: description.collection.name,
			fields: description.columns.reduce((fields, column) => {
				const localizedMatch = localizedFieldName.exec(column.name);
				if (localizedMatch) {
					const handle = localizedMatch[1];
					if (!fields.find(field => field.handle === handle)) {
						fields.push({
							handle,
							type: dbFieldTypeToSchemaFieldType(column.type),
							size: column.size
						});
					}
				} else {
					fields.push({
						handle: column.name,
						type: dbFieldTypeToSchemaFieldType(column.type),
						size: column.size
					});
				}
				return fields;
			}, [] as Field[]),
			indexes: description.indexes.reduce((indexes, index) => {
				const localizedMatch = localizedFieldName.exec(index.name);
				if (localizedMatch) {
					const handle = localizedMatch[1];
					if (!indexes.find(index => index.handle === handle)) {
						const fields = index.columns.reduce((fields, column) => {
							const localizedMatch = localizedFieldName.exec(column!.field.name as string);
							fields!.push({
								handle: localizedMatch && localizedMatch[1] || column!.field.name as string,
								direction: column!.direction
							});
							return fields!;
						}, [] as IndexField[]);

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
						fields: index.columns.reduce((fields, column) => {
							fields!.push({
								handle: column!.field.name as string,
								direction: column!.direction
							});
							return fields!;
						}, [] as IndexField[])
					});
				}
				return indexes;
			}, [] as Index[])
		});
	}

	return schemas;
}