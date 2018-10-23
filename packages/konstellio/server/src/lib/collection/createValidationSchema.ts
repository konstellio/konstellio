import { DocumentNode, DefinitionNode, ObjectTypeDefinitionNode, UnionTypeDefinitionNode, Kind, FieldDefinitionNode, TypeNode } from "graphql";
import { Locales } from "../../server";
import * as Joi from 'joi';
import { getDefNodeByNamedType, isCollection } from "../utilities/ast";

/**
 * Create Joi Schema from Definitions
 */
export function createValidationSchemaFromDefinition(ast: DocumentNode, node: DefinitionNode, locales: Locales): Joi.Schema {
	return transformDocumentNodeToSchema(node);

	function transformDocumentNodeToSchema(node: ObjectTypeDefinitionNode): Joi.ObjectSchema;
	function transformDocumentNodeToSchema(node: UnionTypeDefinitionNode): Joi.ArraySchema;
	function transformDocumentNodeToSchema(node: DefinitionNode): Joi.Schema;
	function transformDocumentNodeToSchema(node: DefinitionNode): Joi.Schema {
		if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
			return Joi.object().keys((node.fields || []).reduce((keys: any, field) => {
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
			return Joi.array().items(...(node.types || []).map(type => {
				const typeNode = getDefNodeByNamedType(ast, type.name.value) as ObjectTypeDefinitionNode;
				return typeNode
					? transformDocumentNodeToSchema(typeNode).keys({
						_typename: Joi.string().valid(typeNode.name.value).required()
					})
					: Joi.any();
			}));
		}
		else if (node.kind === Kind.ENUM_TYPE_DEFINITION) {
			return Joi.string();
		}
		return Joi.any();
	}

	function transformFieldTypeNodeToSchema(node: FieldDefinitionNode): Joi.Schema | undefined {
		const directives = node.directives || [];
		const computed = directives.find(directive => directive.name.value === 'computed') !== undefined;
		if (computed) {
			return undefined;
		}

		const typeSchema = transformTypeNodeToSchema(node.type);
		
		const localized = directives.find(directive => directive.name.value === 'localized') !== undefined;
		if (localized) {
			return Joi.object().keys(Object.keys(locales).reduce((locales, code) => {
				locales[code] = typeSchema;
				return locales;
			}, {} as { [code: string]: Joi.Schema }));
		}

		return typeSchema;
	}

	function transformTypeNodeToSchema(node: TypeNode): Joi.Schema {
		if (node.kind === Kind.NON_NULL_TYPE) {
			return transformTypeNodeToSchema(node.type).required();
		}
		else if (node.kind === Kind.LIST_TYPE) {
			return Joi.array().items(transformTypeNodeToSchema(node.type).optional());
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