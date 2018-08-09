import { ObjectTypeDefinitionNode, UnionTypeDefinitionNode, Kind, DocumentNode, ValueNode, ArgumentNode, TypeNode, DefinitionNode, FieldDefinitionNode, InputObjectTypeDefinitionNode, InputValueDefinitionNode, NamedTypeNode } from "graphql";
import { Locales } from "./utilities/config";
import { Driver } from "@konstellio/db";
import { isCollection, getValue, getDefNodeByNamedType, getNamedTypeNode } from "./utilities/ast";
import { Schema, ObjectSchema, ArraySchema } from "joi";
import * as Joi from 'joi';
import { IResolvers } from "graphql-tools";


export class Collection {

	public static createTypeExtension(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): string {
		return '';
	}

	public static createResolvers(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): IResolvers {
		return {};
	}

	constructor(
	) {
		
	}
}

export class Structure extends Collection {
	
	public static createTypeExtension(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): string {
		if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
			return extendObjectType(node);
		}
		return node.types.reduce((extensions, type) => {
			const node = getDefNodeByNamedType(ast, type.name.value);
			if (node) {
				extensions.push(extendObjectType(node as ObjectTypeDefinitionNode));
			}
			return extensions;
		}, [] as string[]).join(`\n`);

		function extendObjectType(node: ObjectTypeDefinitionNode) {
			return `extend type ${node.name.value}
			@index(handle: "${node.name.value}_struct", type: "index", fields: [{ field: "parent", direction: "asc" }, { field: "order", direction: "asc" }])
			{
				parent: ${node.name.value} @inlined
				left: Int @hidden
				right: Int @hidden
				order: Int @hidden
				children: [${node.name.value}!]! @computed
			}`;
		}
	}

}

export class Single extends Collection {
	
}

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

			const collectionClass = {
				collection: Collection,
				structure: Structure,
				single: Single
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
 * Create Joi Schema from Definitions
 */
export function createValidationSchemasFromDefinitions(ast: DocumentNode, locales: Locales): Map<string, Schema> {
	const schemas = new Map<string, Schema>();

	ast.definitions.forEach(node => {
		if ((node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.UNION_TYPE_DEFINITION) && isCollection(node)) {
			const schema = transformDocumentNodeToSchema(node);
			schemas.set(node.name.value, schema);
		}
	});

	return schemas;

	function transformDocumentNodeToSchema(node: ObjectTypeDefinitionNode): ObjectSchema
	function transformDocumentNodeToSchema(node: UnionTypeDefinitionNode): ArraySchema
	function transformDocumentNodeToSchema(node: DefinitionNode): Schema
	function transformDocumentNodeToSchema(node: DefinitionNode): Schema {
		if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
			return Joi.object().keys(node.fields.reduce((keys, field) => {
				if (field.name.value !== 'id') {
					const schema = transformFieldTypeNodeToSchema(field);
					if (schema) {
						keys[field.name.value] = schema;
					}
				}
				return keys;
			}, {}));
		}
		else if (node.kind === Kind.UNION_TYPE_DEFINITION) {
			return Joi.array().items(...node.types.map(type => {
				const typeNode = getDefNodeByNamedType(ast, type.name.value) as ObjectTypeDefinitionNode;
				return typeNode
					? transformDocumentNodeToSchema(typeNode).keys({
						_typename: Joi.string().valid(typeNode.name.value).required()
					})
					: Joi.any();
			}));
		}
		else if (node.kind === Kind.ENUM_TYPE_DEFINITION) {
			// return [Joi.string(), Joi.number()];
			return Joi.string();
		}
		return Joi.any();
	}

	function transformFieldTypeNodeToSchema(node: FieldDefinitionNode): Schema | undefined {
		const directives = node.directives || [];
		const computed = directives.find(directive => directive.name.value === 'computed') !== undefined;
		if (computed === true) {
			return undefined;
		}

		const typeSchema = transformTypeNodeToSchema(node.type);
		
		const localized = directives.find(directive => directive.name.value === 'localized') !== undefined;
		if (localized) {
			return Joi.object().keys(Object.keys(locales).reduce((locales, code) => {
				locales[code] = typeSchema;
				return locales;
			}, {}));
		}

		return typeSchema;
	}

	function transformTypeNodeToSchema(node: TypeNode): Schema {
		if (node.kind === Kind.NON_NULL_TYPE) {
			return transformTypeNodeToSchema(node.type).required();
		}
		else if (node.kind === Kind.LIST_TYPE) {
			return Joi.array().items(transformTypeNodeToSchema(node.type));
		}

		switch (node.name.value) {
			case 'ID':
			case 'String':
				return Joi.string();
			case 'Int':
				return Joi.number().precision(0);
			case 'Float':
				return Joi.number();
			case 'Boolean':
				return Joi.boolean();
			case 'Date':
			case 'DateTime':
				return Joi.date().iso();
			default:
				const refNode = getDefNodeByNamedType(ast, node.name.value);
				if (refNode === undefined) {
					return Joi.any();
				}
				else if ((refNode.kind === Kind.OBJECT_TYPE_DEFINITION || refNode.kind === Kind.UNION_TYPE_DEFINITION) && isCollection(refNode)) {
					return Joi.string(); // Same as ID
				}
				return transformDocumentNodeToSchema(refNode);
		}
	}
}


/**
 * Build input definitions for each collections
 */
export function createInputTypeFromDefinitions(ast: DocumentNode, locales: Locales): DocumentNode {
	const inputAST: DocumentNode = {
		kind: 'Document',
		definitions: []
	};
	const inputTypes = new Map<string, InputObjectTypeDefinitionNode>();
	const collectionTypes: string[] = [];
	const localizedTypes: string[] = [];

	// Convert Object type definition to Input type definition with their original fields type
	ast.definitions.forEach(node => {
		if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
			if (isCollection(node)) {
				collectionTypes.push(node.name.value);
			}
			const inputType: InputObjectTypeDefinitionNode = {
				kind: 'InputObjectTypeDefinition',
				name: { kind: 'Name', value: `${node.name.value}Input` },
				directives: node.directives || [],
				fields: node.fields.reduce((fields, field) => {
					if (
						field.name.value !== 'id' &&
						(
							field.directives === undefined ||
							field.directives.find(directive => directive.name.value === 'computed') === undefined
						)
					) {
						if (field.directives && field.directives.find(directive => directive.name.value === 'localized')) {
							const typeName = getNamedTypeNode(field.type);
							if (localizedTypes.includes(typeName) === false) {
								localizedTypes.push(typeName);
							}
						}
						fields.push({
							kind: 'InputValueDefinition',
							name: field.name,
							type: field.type,
							directives: field.directives
						});
					}
					return fields
				}, [] as InputValueDefinitionNode[])
			}
			inputTypes.set(node.name.value, inputType);
		}
	});

	// Convert Union type definition to Input type definition
	ast.definitions.forEach(node => {
		if (node.kind === Kind.UNION_TYPE_DEFINITION) {
			const inputType: InputObjectTypeDefinitionNode = {
				kind: 'InputObjectTypeDefinition',
				name: { kind: 'Name', value: `${node.name.value}Input` },
				directives: node.directives || [],
				fields: node.types.reduce((fields, type) => {
					const inputType = inputTypes.get(type.name.value);
					if (inputType) {
						fields.push(...inputType.fields.map(field => {
							field.type = stripNonNullType(field.type);
							return field;
						}));
					}
					return fields;
				}, [
					{
						kind: 'InputValueDefinition',
						name: { kind: 'Name', value: '_typename' },
						type: { kind: 'NonNullType', type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } } }
					}
				] as InputValueDefinitionNode[])
			}
			inputTypes.set(node.name.value, inputType);
		}
	});

	const localCodes = Object.keys(locales);

	// Convert localized types
	localizedTypes.forEach(typeName => {
		const localizedName = `L${typeName}Input`;
		inputTypes.set(`L${typeName}`, {
			kind: 'InputObjectTypeDefinition',
			name: { kind: 'Name', value: localizedName },
			fields: localCodes.reduce((fields, code) => {
				fields.push({
					kind: 'InputValueDefinition',
					name: { kind: 'Name', value: code },
					type: { kind: 'NonNullType', type: { kind: 'NamedType', name: { kind: 'Name', value: typeName } } }
				});
				return fields;
			}, [] as InputValueDefinitionNode[])
		})
	});

	// Convert field type to their corresponding input type or ID if they reference a collection type
	inputTypes.forEach(node => {
		node.directives = undefined;
		node.fields.forEach(field => {
			field.type = transformType(
				field.type,
				field.directives && field.directives.find(directive => directive.name.value === 'localized') !== undefined
			);
			field.directives = undefined;
		});
		inputAST.definitions.push(node);
	});

	return inputAST;

	function stripNonNullType(type: TypeNode): TypeNode {
		if (type.kind === 'ListType') {
			return { kind: 'ListType', type: stripNonNullType(type.type) };
		}
		else if (type.kind === 'NonNullType') {
			return type.type;
		}
		return type;
	}

	function transformType(type: TypeNode, localized = false, union = false): TypeNode {
		if (type.kind === 'ListType') {
			return { kind: 'ListType', type: transformType(type.type, localized, union) };
		}
		else if (type.kind === 'NonNullType') {
			return { kind: 'NonNullType', type: transformType(type.type, localized, union) as NamedTypeNode };
		}
		let name = type.name.value;
		if (localized) {
			name = `L${name}`;
		}
		if (collectionTypes.includes(name)) {
			return { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } };
		}
		const inputType = inputTypes.get(name);
		if (inputType) {
			return { kind: 'NamedType', name: inputType.name };
		}
		return type;
	}
}