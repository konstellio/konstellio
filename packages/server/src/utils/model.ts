import { q, Column, ColumnType, Index, IndexType } from '@konstellio/db';
import { DocumentNode } from 'graphql';
import { parseSchema, Schema, Field, Index as SchemaIndex } from '../utils/schema';
import { Plugin, PluginInitContext } from './plugin';
import { WriteStream, ReadStream } from 'tty';
import { EOL } from 'os';
import { emitKeypressEvents, clearScreenDown, moveCursor } from 'readline';

export type SchemaDiff = {
	type: 'new_collection'
	collection: Schema
} | {
	type: 'new_field'
	collection: Schema
	field: Field
} | {
	type: 'alter_field'
	collection: Schema
	field: Column
} | {
	type: 'drop_field'
	collection: Schema
	field: Column
} | {
	type: 'new_index'
	collection: Schema
	index: SchemaIndex
} | {
	type: 'alter_index'
	collection: Schema
	index: SchemaIndex
} | {
	type: 'drop_index'
	collection: Schema
	index: Index
};

export async function getSchemaDiff(context: PluginInitContext, schemas: Schema[]): Promise<SchemaDiff[]> {
	const db = context.database;
	const diffs: SchemaDiff[] = [];

	for (let i = 0, l = schemas.length; i < l; ++i) {
		const schema = schemas[i];
		const exists = await db.execute(q.collectionExists(schema.handle));
		if (exists.exists) {
			const desc = await db.execute(q.describeCollection(schema.handle));

			desc.columns.forEach(column => {
				const columnName = column.getName();
				const fields = schema.fields.filter(field => field.handle === columnName);

				// Column not found in schema
				if (fields.length === 0) {
					if (column.getName() !== 'id') {
						diffs.push({ type: 'drop_field', collection: schema, field: column });
					}
				}
				else {
					const field = fields[0];

					// Column found, but has new type
					if (mapFieldTypeToColumnType(field.type) !== column.getType()) {
						diffs.push({ type: 'alter_field', collection: schema, field: column });
					}
				}
			});

			schema.fields.forEach(field => {
				// Add missing field from schema
				if (desc.columns.filter(column => column.getName() === field.handle).length === 0) {
					diffs.push({ type: 'new_field', collection: schema, field });
				}
			});

			desc.indexes.forEach(index => {
				const indexName = index.getName();
				const indexes = schema.indexes.filter(index => index.handle === indexName);

				// Index not found in schema
				if (indexes.length === 0) {
					diffs.push({ type: 'drop_index', collection: schema, index });
				}
				else {
					const schemaIndex = indexes[0];

					// Index found, but has new type
					if (mapIndexTypeToIndexType(schemaIndex.type) !== index.getType()) {
						diffs.push({ type: 'alter_index', collection: schema, index: schemaIndex });
					}
					else {
						const columns = index.getColumns();

						// Index is not on the same columns as schema
						if (columns === undefined || columns.size !== Object.keys(schemaIndex.fields).length) {
							diffs.push({ type: 'alter_index', collection: schema, index: schemaIndex });
						}
						else if (columns !== undefined) {
							let fieldsMatch = true;
							for (let j = 0, m = schema.indexes.length; j < m; ++j) {
								const handle = defaultIndexHandle(schema.handle, schema.indexes[j].handle, mapIndexTypeToIndexType(schema.indexes[j].type), schema.indexes[j].fields);
								if (columns.find(column => column!.name === handle) === undefined) {
									fieldsMatch = false;
									break;
								}
							}
							if (fieldsMatch === false) {
								diffs.push({ type: 'alter_index', collection: schema, index: schemaIndex });
							}
						}
					}
				}
			});
		}
		else {
			diffs.push({ type: 'new_collection', collection: schema });
		}
	}

	return diffs;
}

function mapFieldTypeToColumnType(type: string): ColumnType {
	switch (type) {
		case 'int':
			return ColumnType.Int32;
		case 'float':
			return ColumnType.Float32;
		case 'text':
		case 'password':
		case 'slug':
		case 'html':
			return ColumnType.Text;
		case 'date':
			return ColumnType.DateTime;
		case 'datetime':
			return ColumnType.DateTime;
		default:
			throw new Error(`Unknown field type ${type}.`);
	}
}

function mapIndexTypeToIndexType(type: string): IndexType {
	switch (type) {
		default:
			throw new Error(`Unknown index type ${type}.`);
	}
}

function defaultIndexHandle(collection: string, handle: string | undefined, type: IndexType, fields: { [fieldHandle: string]: 'asc' | 'desc' }) {
	return handle || `${collection}_${Object.keys(fields).join('_')}_${type === IndexType.Primary ? 'pk' : (type === IndexType.Unique ? 'uniq' : 'idx')}`
}

export async function executeSchemaDiff(context: PluginInitContext, diffs: SchemaDiff[]): Promise<void>
export async function executeSchemaDiff(context: PluginInitContext, diffs: SchemaDiff[], stdin: ReadStream, stdout: WriteStream): Promise<void>
export async function executeSchemaDiff(context: PluginInitContext, diffs: SchemaDiff[], stdin?: ReadStream, stdout?: WriteStream): Promise<void> {
	
	function ErrorNeedsTTY() {
		return new Error(`Some changes were made to the schema.`);
	}

	for (let i = 0, l = diffs.length; i < l; ++i) {
		const diff = diffs[i];

		if (diff.type === 'new_collection') {
			const collectionName = diff.collection.handle;
			const columns = [q.column('id', ColumnType.Text)]
				.concat(
					diff.collection.fields
					.filter(field => field.type !== 'relation')
					.map<Column>(field => {
						return q.column(field.handle, mapFieldTypeToColumnType(field.type));
					})
				);
			
			const indexes = [q.index(`${collectionName}_id_pk`, IndexType.Primary).columns('id', 'asc')]
				.concat(
					diff.collection.indexes
					.map<Index>(index => {
						const type = mapIndexTypeToIndexType(index.type);
						const handle = defaultIndexHandle(collectionName, index.handle, type, index.fields);
						const fields = Object.keys(index.fields).map(field => {
							return q.sort(field, index.fields[field]);
						});
						return q.index(handle, type).columns(...fields);
					})
				);

			const createCollection = q.createCollection(collectionName).columns(...columns).indexes(...indexes);
			
			const result = await context.database.execute(createCollection);
			if (result.acknowledge === false) {
				throw new Error(`Could not create collection ${diff.collection.handle}.`);
			}
		}

		else if (diff.type === 'drop_field') {
			if (stdin && stdout) {
				const handle = `${diff.collection.handle}.${diff.field.getName()}`;
				const choice = await promptSelection(stdin, stdout, `Field ${handle} is no longer defined in the schema, but still present in the database. How do I proceed ?`, new Map<string, string>([
					['drop', `Drop ${handle}`],
					['rename1', `Rename ${handle} to...`],
					['rename2', `Rename ${handle} to...`]
				]));
				debugger;
			}
			else {
				throw ErrorNeedsTTY();
			}
		}

		else {
			throw new Error(`Could not handle diff ${diff.type}.`);
		}
	}

}

function promptSelection(stdin: ReadStream, stdout: WriteStream, question: string, selections: Map<string, string>): Promise<string> {
	return new Promise((resolve, reject) => {
		emitKeypressEvents(stdin);
		stdin.setRawMode(true);

		stdout.write(question + EOL);
		stdout.write(EOL);

		let selectedIndex = 0;
		let resetSelection = 0;

		function drawSelections() {
			let out = '';
			let i = -1;
			selections.forEach((label, key) => {
				const idx = ++i;
				out += `  [${idx === selectedIndex ? 'x' : ' '}] ${label}${EOL}`;
			});
			out += EOL;

			moveCursor(stdout, 0, resetSelection);
			clearScreenDown(stdout);
			stdout.write(out);

			// resetSelection = -out.length;
			resetSelection = -(out.split(EOL).length - 1);
		}

		stdin.on('keypress', (chunk, key) => {
			if (key.name === 'up') {
				selectedIndex = Math.max(0, selectedIndex - 1);
				drawSelections();
			}
			else if (key.name === 'down') {
				selectedIndex = Math.min(selections.size - 1, selectedIndex + 1);
				drawSelections();
			}
			else if (key.name === 'return') {
				stdin.pause();
				stdin.setRawMode(false);

				const choice = Array.from(selections.keys())[selectedIndex];

				resolve(choice);
			}
			else if (key.sequence === "\u0003") {
				stdin.pause();
				stdin.setRawMode(false);

				reject(new Error(`User did not made a choice.`));
			}
		});

		drawSelections();
	});
}