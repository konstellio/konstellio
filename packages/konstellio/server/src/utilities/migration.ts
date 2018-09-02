import { DocumentNode, ObjectTypeDefinitionNode, DefinitionNode, Kind, DirectiveNode, FieldDefinitionNode, TypeNode } from "graphql";
import { Database, q, Column as DBColumn, Index as DBIndex, ColumnType, IndexType, QueryCreateCollection, Compare, QueryAlterCollection, QueryDropCollection, FieldDirection } from "@konstellio/db";
import * as assert from 'assert';
import { isArray } from "util";
import { WriteStream, ReadStream } from 'tty';
import { Locales } from "../server";
import { isCollection, getArgumentsValues, isListType } from "./ast";
import { promptSelection } from "./cli";


export interface Schema {
	collections: Collection[];
}

export interface Collection {
	handle: string;
	indexes: Index[];
	fields: Field[];
}

export interface IndexField {
	field: string;
	direction?: 'asc' | 'desc';
}

export interface Index {
	handle: string;
	type: IndexType;
	fields: IndexField[];
}

export interface Field {
	handle: string;
	type: ColumnType;
	size?: number;
}

export type SchemaDiff = SchemaDiffAddCollection | SchemaDiffRenameCollection | SchemaDiffDropCollection | SchemaDiffAddField | SchemaDiffDropField | SchemaDiffAlterField | SchemaDiffAddIndex | SchemaDiffAlterIndex | SchemaDiffDropIndex;

export type SchemaDiffAddCollection = {
	action: 'add_collection'
	collection: Collection
	sourceSchema: Schema
	renamedTo?: string
};

export type SchemaDiffRenameCollection = {
	action: 'rename_collection'
	collection: Collection
	renamedFrom: string
};

export type SchemaDiffDropCollection = {
	action: 'drop_collection'
	collection: Collection
};

export type SchemaDiffAddField = {
	action: 'add_field'
	collection: Collection
	field: Field
	sourceCollection: Collection
	renamedTo?: string
};

export type SchemaDiffDropField = {
	action: 'drop_field'
	collection: Collection
	field: Field
};

export type SchemaDiffAlterField = {
	action: 'alter_field'
	collection: Collection
	field: Field
	sourceCollection: Collection
};

export type SchemaDiffAddIndex = {
	action: 'add_index'
	collection: Collection
	index: Index
};

export type SchemaDiffAlterIndex = {
	action: 'alter_index'
	collection: Collection
	index: Index
};

export type SchemaDiffDropIndex = {
	action: 'drop_index'
	collection: Collection
	index: Index
};

/**
 * Create Schema from DocumentNode
 */
export async function createSchemaFromDefinitions(ast: DocumentNode, locales: Locales, supportsJoin: boolean): Promise<Schema> {
	return {
		collections: ast.definitions.reduce((collections, node) => {
			if (isCollection(node)) {
				const collection = transformDocumentNodeToCollection(node);
				if (collection) {
					collections.push(collection);
				}
			}
			return collections;
		}, [] as Collection[])
	};

	function getDefNodeByNamedType(name: string): DefinitionNode | undefined {
		return ast.definitions.find((def: any) => def.name && def.name.value === name);
	}

	function transformDocumentNodeToCollection(node: DefinitionNode): Collection | undefined {
		if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
			return {
				handle: node.name.value,
				indexes: transformDirectivesToIndexes(node.directives, node.fields),
				fields: transformFieldsToFields(node.fields)
			};
		}
		else if (node.kind === Kind.UNION_TYPE_DEFINITION) {
			const fields = (node.types || []).reduce((fields, type) => {
				const typeNode = getDefNodeByNamedType(type.name.value) as ObjectTypeDefinitionNode;
				if (typeNode.fields) {
					fields.push(...typeNode.fields);
				}
				return fields;
			}, [] as FieldDefinitionNode[]);
			return {
				handle: node.name.value,
				indexes: transformDirectivesToIndexes(node.directives, fields),
				fields: [{ handle: '_typename', type: 'Text' as ColumnType }].concat(transformFieldsToFields(fields))
			};
		}
	}

	function transformDirectivesToIndexes(directives: ReadonlyArray<DirectiveNode> | undefined, fields: ReadonlyArray<FieldDefinitionNode> | undefined): Index[] {
		return (directives || []).reduce((indexes, directive) => {
			if (directive.name.value === 'index') {
				const args = getArgumentsValues(directive.arguments);
				assert(typeof args.handle === 'string', 'Expected field @index.handle of type string.');
				assert(typeof args.type === 'string', 'Expected field @index.type of type string.');
				assert(['primary', 'unique', 'index'].indexOf(args.type) > -1, 'Expected field @index.type to be either "primary", "unique" or "index".');
				assert(args.fields && isArray(args.fields), 'Expected field @index.fields of type array.');
				(args.fields as IndexField[] || []).forEach(field => {
					assert(typeof field.field === 'string', 'Expected field @index.fields[].field of type string');
					assert(['asc', 'desc'].indexOf(field.direction || '') > -1, 'Expected field @index.fields[].direction to be either "asc" or "desc".');
				});
				const localized = (args.fields as IndexField[]).reduce((localize, field) => {
					const fieldNode = (fields || []).find(f => f.name.value === field.field);
					if (fieldNode) {
						const directives = fieldNode.directives || [];
						const localized = directives.find(directive => directive.name.value === 'localized') !== undefined;
						if (localized) {
							localize.push(field.field);
						}
					}
					return localize;
				}, [] as string[]);

				if (localized.length > 0) {
					Object.keys(locales).forEach(code => {
						indexes.push({
							handle: `${args.handle}__${code}`,
							type: args.type as IndexType,
							fields: (args.fields as IndexField[]).map(field => ({
								field: localized.includes(field.field) ? `${field.field}__${code}` : field.field,
								direction: field.direction
							}))
						});
					});
				} else {
					indexes.push({
						handle: args.handle,
						type: args.type as IndexType,
						fields: args.fields as IndexField[]
					});
				}
			}
			return indexes;
		}, [] as Index[]);
	}

	function transformFieldsToFields(fields: ReadonlyArray<FieldDefinitionNode> | undefined): Field[] {
		return (fields || []).reduce((fields, field) => {
			const directives = field.directives || [];
			const computed = directives.find(directive => directive.name.value === 'computed') !== undefined;
			const inlined = directives.find(directive => directive.name.value === 'inlined') !== undefined;
			const multiple = isListType(field.type);
			const localized = directives.find(directive => directive.name.value === 'localized') !== undefined;
			
			// const type = inlined
			// 	? [ColumnType.Blob, -1, true] as [ColumnType, number, boolean]
			// 	: transformTypeNodeToType(field.type);
			let type = transformTypeNodeToType(field.type);

			if (inlined) {
				type = [
					type && !type[2] ? type[0] : ColumnType.Text,
					type ? type[1] : -1,
					true
				];
			}

			if (
				!computed &&
				type &&
				(!multiple || type[2])
			) {
				if (localized) {
					Object.keys(locales).forEach(code => {
						fields.push({
							handle: `${field.name.value}__${code}`,
							type: type![0],
							size: type![1]
						});
					});
				} else {
					fields.push({
						handle: field.name.value,
						type: type[0],
						size: type[1]
					});
				}
			}
			return fields;
		}, [] as Field[]);
	}

	function transformTypeNodeToType(node: TypeNode): [ColumnType, number, boolean] | undefined {
		if (node.kind === Kind.NON_NULL_TYPE || node.kind === Kind.LIST_TYPE) {
			return transformTypeNodeToType(node.type);
		}

		switch (node.name.value) {
			case 'ID':
				return [ColumnType.Text, -1, false];
			case 'String':
				return [ColumnType.Text, -1, false];
			case 'Int':
				return [ColumnType.Int, -1, false];
			case 'Float':
				return [ColumnType.Float, -1, false];
			case 'Boolean':
				return [ColumnType.Boolean, -1, false];
			case 'Date':
				return [ColumnType.Date, -1, false];
			case 'DateTime':
				return [ColumnType.DateTime, -1, false];
			default:
				const refNode = getDefNodeByNamedType(node.name.value);
				if (refNode) {
					if (refNode.kind === Kind.ENUM_TYPE_DEFINITION) {
						return [ColumnType.Text, -1, false];
					}
					else if (isCollection(refNode) && !supportsJoin) {
						return [ColumnType.Text, -1, true];
					}
					else if (!isCollection(refNode)) {
						return [ColumnType.Blob, -1, true];
					}
				}
		}
	}
}

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

export type compareTypes = (aType: ColumnType, aSize: number, bType: ColumnType, bSize: number) => Compare;

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

/**
 * Prompt user for migration diffs
 */
export async function promptSchemaDiffs(stdin: ReadStream, stdout: WriteStream, diffs: SchemaDiff[], compareTypes: compareTypes): Promise<SchemaDiff[]> {
	const actions: SchemaDiff[] = [];
	const renamedCollection: string[] = [];
	
	for (const diff of diffs) {
		if (diff.action === 'add_collection') {
			const tmpSchema = { collections: [{ handle: diff.collection.handle, fields: diff.collection.fields, indexes: [] }] };
			const similarCollections = diff.sourceSchema.collections.filter(collection => computeSchemaDiff(
				tmpSchema,
				{ collections: [{ handle: diff.collection.handle, fields: collection.fields, indexes: [] }] },
				compareTypes
			).length === 0);

			if (similarCollections.length > 0) {
				const choices = ([['$empty', `Leave \`${diff.collection.handle}\` empty`]] as [string, string][]).concat(
					similarCollections.map<[string, string]>(collection => ([collection.handle, `Copy content from \`${collection.handle}\``])),
					[['$abort', `Abort migration`]]
				);
				let choice: string;
				try {
					choice = await promptSelection(stdin, stdout, `Schema has a new collection \`${diff.collection.handle}\`, how do we initialize it?`, new Map(choices));
				} catch (err) {
					choice = '$abort';
				}

				if (choice === '$abort') {
					throw new Error(`User aborted migration.`);
				}
				else if (choice === '$empty') {
					actions.push(diff);
				}
				else {
					renamedCollection.push(choice);
					actions.push({
						action: 'rename_collection',
						collection: diff.collection,
						renamedFrom: choice
					});
				}
			} else {
				actions.push(diff);
			}
		}
		else if (diff.action === 'add_field') {
			const collection = diff.collection;
			const newField = diff.field;
			const sourceFieldsOfSameType = diff.sourceCollection.fields.filter(field => field.type === newField.type);
			if (sourceFieldsOfSameType.length > 0) {
				const sourceFieldsOfSameTypeNoLongerUsed = sourceFieldsOfSameType.filter(field => collection.fields.find(f => f.handle === field.handle) === undefined);
				const choices = ([['$empty', `Leave \`${collection.handle}\`.\`${newField.handle}\` empty`]] as [string, string][]).concat(
					sourceFieldsOfSameTypeNoLongerUsed.map<[string, string]>(field => ([field.handle, `Copy content from \`${collection.handle}\`.\`${field.handle}\``])),
					[['$abort', `Abort migration`]]
				);
				let choice: string;
				try {
					choice = await promptSelection(stdin, stdout, `Schema has a new field \`${collection.handle}\`.\`${newField.handle}\`, how do we initialize it?`, new Map(choices));
				} catch (err) {
					choice = '$abort';
				}

				if (choice === '$abort') {
					throw new Error(`User aborted migration.`);
				}
				else if (choice === '$empty') {
					actions.push(diff);
				}
				else {
					actions.push({
						...diff,
						renamedTo: choice
					});
				}
			} else {
				actions.push(diff);
			}
		}
		else if (diff.action === 'drop_field') {
			const collection = diff.collection;
			const dropField = diff.field;
			const choices: [string, string][] = [['$drop', `Drop \`${collection.handle}\`.\`${dropField.handle}\``], ['$abort', `Abort migration`]];
			let choice: string;
			try {
				choice = await promptSelection(stdin, stdout, `Field \`${collection.handle}\`.\`${dropField.handle}\` is no longer defined in schema, confirm deletion?`, new Map(choices));
			} catch (err) {
				choice = '$abort';
			}

			if (choice === '$abort') {
				throw new Error(`User aborted migration.`);
			}
			else {
				actions.push(diff);
			}
		}
		else if (diff.action === 'drop_collection') {
			const collection = diff.collection;
			if (!renamedCollection.includes(collection.handle)) {
				const choices: [string, string][] = [['$drop', `Drop \`${collection.handle}\``], ['$abort', `Abort migration`]];
				let choice: string;
				try {
					choice = await promptSelection(stdin, stdout, `Collection \`${collection.handle}\` is no longer defined in schema, confirm deletion?`, new Map(choices));
				} catch (err) {
					choice = '$abort';
				}

				if (choice === '$abort') {
					throw new Error(`User aborted migration.`);
				}
				else {
					actions.push(diff);
				}
			}
		}
		else {
			actions.push(diff);
		}
	}

	return actions;
}

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
				.map<DBColumn>(field => {
					return q.column(field.handle, field.type, field.size);
				});

			const indexes = diff.collection.indexes
				.map<DBIndex>(index => {
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