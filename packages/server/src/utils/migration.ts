import { Driver, q, Compare, Column, ColumnType, Index, IndexType, QueryAlterCollection, QueryCreateCollection, QueryCreateCollectionResult, QueryAlterCollectionResult, QueryDescribeCollectionResult, FieldDirection, QueryDropCollection, QueryDropCollectionResult } from '@konstellio/db';
import { DocumentNode } from 'graphql';
import { parseSchema, Schema, Field, Index as SchemaIndex } from '../utils/schema';
import { Plugin } from '../plugin';
import { WriteStream, ReadStream } from 'tty';
import { promptSelection } from './cli';
import { Locales } from './config';

function defaultIndexHandle(collection: string, handle: string | undefined, type: IndexType, fields: { [fieldHandle: string]: 'asc' | 'desc' }) {
	return handle || `${collection}_${Object.keys(fields).join('_')}_${type === IndexType.Primary ? 'pk' : (type === IndexType.Unique ? 'uniq' : 'idx')}`
}

export type SchemaDescription = {
	handle: string
	columns: SchemaDescriptionColumn[]
	indexes: SchemaDescriptionIndex[]
}

export type SchemaDescriptionColumn = {
	handle: string,
	type: string
}

export type SchemaDescriptionIndex = {
	handle: string
	type: string
	columns: { [handle: string]: 'asc' | 'desc' }
}

export type SchemaDiff = SchemaDiffAddCollection | SchemaDiffDropCollection | SchemaDiffAddColumn | SchemaDiffDropColumn | SchemaDiffAlterColumn | SchemaDiffAddIndex | SchemaDiffDropIndex;

export type SchemaDiffAddCollection = {
	action: 'add_collection'
	collection: SchemaDescription
}

export type SchemaDiffDropCollection = {
	action: 'drop_collection'
	collection: string
}

export type SchemaDiffAddColumn = {
	action: 'add_column'
	collection: SchemaDescription
	column: SchemaDescriptionColumn
	copyColumn: string[]
}

export type SchemaDiffDropColumn = {
	action: 'drop_column'
	collection: SchemaDescription
	column: SchemaDescriptionColumn
}

export type SchemaDiffAlterColumn = {
	action: 'alter_column'
	collection: SchemaDescription
	column: SchemaDescriptionColumn
	type: string
}

export type SchemaDiffAddIndex = {
	action: 'add_index'
	collection: SchemaDescription
	index: SchemaDescriptionIndex
}

export type SchemaDiffDropIndex = {
	action: 'drop_index'
	collection: SchemaDescription
	index: SchemaDescriptionIndex
}

function matchLocalizedHandle(handle: string): RegExpMatchArray | null {
	return handle.match(/^([a-zA-Z0-9_-]+)__([a-z]{2}(-[a-zA-Z]{2})?)$/i);
}

export async function getSchemaDiff(database: Driver, locales: Locales, schemas: Schema[]): Promise<SchemaDiff[]> {

	const diffs: SchemaDiff[] = [];

	const mutedCollections: string[] = ['Relation'];
	const result = await database.execute(q.showCollection());

	for (let i = 0, l = schemas.length; i < l; ++i) {
		const schema = schemas[i];
		const schemaDesc = schemaToSchemaDescription(locales, schema);
		const exists = await database.execute(q.collectionExists(schema.handle));

		mutedCollections.push(schema.handle);

		if (exists.exists === false) {
			diffs.push({
				action: 'add_collection',
				collection: schemaDesc
			});
		} else {
			const desc = await database.execute(q.describeCollection(schema.handle));
			const dbSchemaDesc = databaseDescriptionToSchemaDescription(locales, desc);
			const mutedFields: string[] = [];
			const mutedIndexes: string[] = [];

			dbSchemaDesc.columns.forEach(dbColumn => {
				const [dbColumnType, dbColumnSize] = mapStringToColumnType(dbColumn.type);
				const column = schemaDesc.columns.find(column => column.handle === dbColumn.handle);
				if (column === undefined) {
					diffs.push({
						action: 'drop_column',
						collection: schemaDesc,
						column: dbColumn
					});
				}
				else {
					const [columnType, columnSize] = mapStringToColumnType(column.type);

					if ((database.compareTypes(columnType, dbColumnType) & Compare.Castable) === 0) {
						mutedFields.push(column.handle);
						diffs.push({
							action: 'alter_column',
							collection: schemaDesc,
							column: dbColumn,
							type: column.type
						});
					}
					else {
						mutedFields.push(column.handle);
					}
				}
			});
			schemaDesc.columns.forEach(column => {
				if (mutedFields.indexOf(column.handle) === -1) {
					const match = matchLocalizedHandle(column.handle);
					diffs.push({
						action: 'add_column',
						collection: schemaDesc,
						column: column,
						copyColumn: match
							? dbSchemaDesc.columns.map(column => column.handle).filter(handle => { const m2 = matchLocalizedHandle(handle); return m2 && m2[1] === match[1]; })
							: dbSchemaDesc.columns.map(column => column.handle)
					});
				}
			});
			
			dbSchemaDesc.indexes.forEach(dbIndex => {
				const index = schemaDesc.indexes.find(index => index.handle === dbIndex.handle);
				if (index === undefined) {
					mutedIndexes.push(dbIndex.handle);
					diffs.push({
						action: 'drop_index',
						collection: schemaDesc,
						index: dbIndex
					});
				}
				else {
					mutedIndexes.push(dbIndex.handle);
				}
			});
			schemaDesc.indexes.forEach(index => {
				if (mutedIndexes.indexOf(index.handle) === -1) {
					diffs.push({
						action: 'add_index',
						collection: schemaDesc,
						index: index
					});
				}
			});
		}
	}

	for (let i = 0, l = result.collections.length; i < l; ++i) {
		const collection = result.collections[i];
		if (mutedCollections.indexOf(collection.toString()) === -1) {
			diffs.push({
				action: 'drop_collection',
				collection: collection.toString()
			});
		}
	}

	return diffs;
}

export async function executeSchemaMigration(database: Driver, diffs: SchemaDiff[]): Promise<void>
export async function executeSchemaMigration(database: Driver, diffs: SchemaDiff[], stdin: ReadStream, stdout: WriteStream): Promise<void>
export async function executeSchemaMigration(database: Driver, diffs: SchemaDiff[], stdin?: ReadStream, stdout?: WriteStream): Promise<void> {
	const createCollections: QueryCreateCollection[] = [];
	const dropCollections: QueryDropCollection[] = [];
	const alterCollections: Map<string, QueryAlterCollection> = new Map();
	const muteNewColumn: string[] = [];

	const actionOrder = ['drop_collection', 'drop_column'];

	diffs = diffs.sort((a, b) => {
		let ai = actionOrder.indexOf(a.action);
		ai = ai === -1 ? actionOrder.length : ai;
		let bi = actionOrder.indexOf(b.action);
		bi = bi === -1 ? actionOrder.length : bi;
		return ai - bi;
	});

	for (let i = 0, l = diffs.length; i < l; ++i) {
		const diff = diffs[i];

		if (diff.action === 'add_collection') {
			const columns = diff.collection.columns
				.map<Column>(column => {
					const [type, size] = mapStringToColumnType(column.type);
					return q.column(column.handle, type, size);
				});
			
			const indexes = diff.collection.indexes
				.map<Index>(index => {
					const columns = Object.keys(index.columns).map(name => {
						return q.sort(q.field(name), index.columns[name]);
					});
					return q.index(index.handle, mapStringToIndexType(index.type), columns);
				});
			
			createCollections.push(q.createCollection(diff.collection.handle).define(columns, indexes));
		}
		else if (diff.action === 'drop_collection') {
			const collectionName = diff.collection;
			if (stdin && stdout) {
				// IDEA Find out if a new collection has the same fields & index and ask if we should rename instead of drop
				const choices = ([['drop', `Drop \`${collectionName}\``], ['abort', `Abort migration`]] as [string, string][])
				let choice: string;
				try {
					choice = await promptSelection(stdin, stdout, `\`${collectionName}\` is no longer in schema, confirm deletion?`, new Map(choices));
				} catch (err) {
					throw new Error(`User aborted migration.`);
				}

				if (choice === 'abort') {
					throw new Error(`User aborted migration.`);
				}

				dropCollections.push(q.dropCollection(collectionName));
			} else {
				throw new Error(`Schema has some new additions that requires your intervention. Please use a TTY terminal.`);
			}
		}
		else if (diff.action === 'add_column') {
			const collectionHandle = diff.collection.handle;
			const columnName = `${collectionHandle}.${diff.column.handle}`;
			if (muteNewColumn.indexOf(columnName) === -1) {
				if (alterCollections.has(collectionHandle) === false) {
					alterCollections.set(
						collectionHandle,
						q.alterCollection(collectionHandle)
					);
				}

				let choice: string | undefined;

				if (diff.copyColumn.length > 0) {
					if (stdin && stdout) {
						const choices = ([['empty', `Leave \`${columnName}\` empty`]] as [string, string][])
							.concat(
								diff.copyColumn.map<[string, string]>(copy => ([copy, `Copy content from \`${collectionHandle}.${copy}\``])),
								[['abort', `Abort migration`]]
							);

						try {
							choice = await promptSelection(stdin, stdout, `Schema has a new field \`${columnName}\`, how do we initialize it?`, new Map(choices));
						} catch (err) {
							throw new Error(`User aborted migration.`);
						}

						if (choice === 'abort') {
							throw new Error(`User aborted migration.`);
						}

						else if (choice === 'empty') {
							choice = undefined;
						}
					} else {
						throw new Error(`Schema has some new additions that requires your intervention. Please use a TTY terminal.`);
					}
				}

				const [type, size] = mapStringToColumnType(diff.column.type);
				alterCollections.set(
					collectionHandle,
					alterCollections.get(collectionHandle)!.addColumn(q.column(diff.column.handle, type, size), choice)
				);
			}
		}
		else if (diff.action === 'alter_column') {
			const collectionHandle = diff.collection.handle;

			if (alterCollections.has(collectionHandle) === false) {
				alterCollections.set(collectionHandle, q.alterCollection(collectionHandle));
			}

			const [type, size] = mapStringToColumnType(diff.type);
			alterCollections.set(
				collectionHandle,
				alterCollections.get(collectionHandle)!.alterColumn(diff.column.handle, q.column(diff.column.handle, type, size))
			);
		}
		else if (diff.action === 'drop_column') {
			if (stdin && stdout) {
				const collectionHandle = diff.collection.handle;
				const columnName = `${collectionHandle}.${diff.column.handle}`;

				const choices: [string, string][] = [['drop', `Drop \`${columnName}\``], ['abort', `Abort migration`]];
				let choice: string | undefined;

				try {
					choice = await promptSelection(stdin, stdout, `Field \`${columnName}\` is no longer defined in schema, confirm deletion?`, new Map(choices));
				} catch (err) {
					throw new Error(`User aborted migration.`);
				}

				if (choice === 'abort') {
					throw new Error(`User aborted migration.`);
				}

				if (alterCollections.has(collectionHandle) === false) {
					alterCollections.set(collectionHandle, q.alterCollection(collectionHandle));
				}
				alterCollections.set(
					collectionHandle,
					alterCollections.get(collectionHandle)!.dropColumn(diff.column.handle)
				);
			} else {
				throw new Error(`Schema has some new deletions that requires your intervention. Please use a TTY terminal.`);
			}
		}
		else if (diff.action === 'add_index') {
			const collectionHandle = diff.collection.handle;
			const columns = Object.keys(diff.index.columns).map<FieldDirection>(handle => q.sort(q.field(handle), diff.index.columns[handle]));

			if (alterCollections.has(collectionHandle) === false) {
				alterCollections.set(collectionHandle, q.alterCollection(collectionHandle));
			}
			alterCollections.set(
				collectionHandle,
				alterCollections.get(collectionHandle)!.addIndex(q.index(diff.index.handle, mapStringToIndexType(diff.index.type), columns))
			);
		}
		else if (diff.action === 'drop_index') {
			const collectionHandle = diff.collection.handle;

			if (alterCollections.has(collectionHandle) === false) {
				alterCollections.set(collectionHandle, q.alterCollection(collectionHandle));
			}
			alterCollections.set(
				collectionHandle,
				alterCollections.get(collectionHandle)!.dropIndex(diff.index.handle)
			);
		}
	}

	const queries: Promise<QueryCreateCollectionResult | QueryDropCollectionResult | QueryAlterCollectionResult>[] = ([] as Promise<QueryCreateCollectionResult | QueryDropCollectionResult | QueryAlterCollectionResult>[]).concat(
		dropCollections.map(drop => database.execute(drop)),
		createCollections.map(create => database.execute(create)),
		Array.from(alterCollections.values()).map(alter => database.execute(alter))
	);

	await Promise.all(queries);
}

function schemaToSchemaDescription(locales: Locales, schema: Schema): SchemaDescription {
	const localeCodes = Object.keys(locales);
	return {
		handle: schema.handle,
		columns: schema.fields.reduce((columns, field) => {
			if (field.type === 'relation') {
				return columns;
			} else if (field.localized) {
				localeCodes.forEach(code => {
					columns.push({ handle: `${field.handle}__${code}`, type: field.type })
				});
			} else {
				columns.push({ handle: field.handle, type: field.type });
			}
			return columns;
		}, [] as SchemaDescriptionColumn[]),
		indexes: schema.indexes.reduce((indexes, index) => {
			let localized = false;
			Object.keys(index.fields).forEach(name => {
				const field = schema.fields.find(f => f.handle === name);
				localized = localized || (field !== undefined && field.localized === true);
			});
			if (localized) {
				localeCodes.forEach(code => {
					indexes.push({
						handle: `${index.handle}__${code}`,
						type: index.type,
						columns: Object.keys(index.fields).reduce((fields, name) => {
							const field = schema.fields.find(f => f.handle === name);
							if (field !== undefined && field.localized === true) {
								fields[`${name}__${code}`] = index.fields[name];
							} else {
								fields[name] = index.fields[name];
							}
							return fields;
						}, {})
					});
				});
			} else {
				indexes.push({
					handle: index.handle,
					type: index.type,
					columns: index.fields
				})
			}
			return indexes;
		}, [] as SchemaDescriptionIndex[])
	};
}

function databaseDescriptionToSchemaDescription(locales: Locales, description: QueryDescribeCollectionResult): SchemaDescription {
	const localeCodes = Object.keys(locales);

	return {
		handle: description.collection.toString(),
		columns: description.columns.reduce((columns, column) => {
			columns.push({
				handle: column.name,
				type: mapColumnTypeToFieldType(column.type)
			});
			return columns;
		}, [] as SchemaDescriptionColumn[]),
		indexes: description.indexes.reduce((indexes, index) => {
			const type = index.type;
			const columns = index.columns;
			let handle = index.name;
			const localized = columns.reduce((localized: boolean, column: FieldDirection) => {
				const match = matchLocalizedHandle(column.field.name);
				return localized || match !== null;
			}, false);
			indexes.push({
				handle: handle,
				type: type,
				columns: columns.reduce((columns: { [handle: string]: 'asc' | 'desc' }, field: FieldDirection) => {
					if (localized) {
						const match = matchLocalizedHandle(field.field.name);
						if (match) {
							columns[match[1]] = field.direction || 'asc';
						} else {
							columns[field.field.name] = field.direction || 'asc';
						}
					} else {
						columns[field.field.name] = field.direction || 'asc';
					}
					return columns!;
				}, {} as { [handle: string]: 'asc' | 'desc' })
			});
			return indexes;
		}, [] as SchemaDescriptionIndex[])
	};
}

function mapStringToColumnType(type: string): [ColumnType, number | undefined] {
	switch (type) {
		case 'int':
			return [ColumnType.Int, 64];
		case 'float':
			return [ColumnType.Float, 64];
		case 'text':
		case 'password':
		case 'slug':
		case 'html':
			return [ColumnType.Text, undefined];
		case 'date':
			return [ColumnType.DateTime, undefined];
		case 'datetime':
			return [ColumnType.DateTime, undefined];
		default:
			throw new Error(`Unknown field type ${type}.`);
	}
}

function mapStringToIndexType(type: string): IndexType {
	switch (type) {
		case 'primary':
			return IndexType.Primary;
		case 'unique':
			return IndexType.Unique;
		case 'index':
			return IndexType.Index;
		default:
			throw new Error(`Unknown index type ${type}.`);
	}
}

function mapColumnTypeToFieldType(type: ColumnType): string {
	switch (type) {
		case ColumnType.Int:
			return 'int';
		case ColumnType.Float:
			return 'float';
		case ColumnType.Text:
			return 'text';
		case ColumnType.Date:
			return 'date';
		case ColumnType.DateTime:
			return 'datetime';
		case ColumnType.Blob:
			return 'blob';
		default:
			throw new Error(`Unknown field type ${type}.`);
	}
}

function mapIndexTypeToString(type: IndexType): string {
	switch (type) {
		case IndexType.Primary:
			return 'primary';
		case IndexType.Unique:
			return 'unique';
		default:
			return 'index';
	}
}