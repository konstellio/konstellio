import { DocumentNode, DefinitionNode, Kind, ObjectTypeDefinitionNode, FieldDefinitionNode, DirectiveNode, TypeNode } from "graphql";
import { Locales } from "../../server";
import { Schema, Collection, Index, IndexField, Field } from "./types";
import { isCollection, getArgumentsValues, isListType } from "../utilities/ast";
import { ColumnType, IndexType } from "@konstellio/db";
import { isArray } from "util";
import assert = require("assert");

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
			if (directive.name.value === 'collection') {
				const args = getArgumentsValues(directive.arguments);
				assert(!args.indexes || isArray(args.indexes), 'Expected field @collection.indexes of type array.');
				(args.indexes || []).forEach((index: Index) => {
					assert(typeof index.handle === 'string', 'Expected field @collection.indexes.handle of type string.');
					assert(typeof index.type === 'string', 'Expected field @collection.indexes.type of type string.');
					assert(['primary', 'unique', 'index'].indexOf(index.type) > -1, 'Expected field @collection.indexes.type to be either "primary", "unique" or "index".');
					assert(index.fields && isArray(index.fields), 'Expected field @collection.indexes.fields of type array.');
					(index.fields as IndexField[] || []).forEach(field => {
						assert(typeof field.field === 'string', 'Expected field @collection.indexes.fields[].field of type string');
						assert(['asc', 'desc'].indexOf(field.direction || '') > -1, 'Expected field @collection.indexes.fields[].direction to be either "asc" or "desc".');
					});
					const localized = (index.fields as IndexField[]).reduce((localize, field) => {
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
								handle: `${index.handle}__${code}`,
								type: index.type as IndexType,
								fields: (index.fields as IndexField[]).map(field => ({
									field: localized.includes(field.field) ? `${field.field}__${code}` : field.field,
									direction: field.direction
								}))
							});
						});
					} else {
						indexes.push({
							handle: index.handle,
							type: index.type as IndexType,
							fields: index.fields as IndexField[]
						});
					}
				});
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