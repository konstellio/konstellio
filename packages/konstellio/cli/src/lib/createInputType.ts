import { DocumentNode, InputObjectTypeDefinitionNode, Kind, InputValueDefinitionNode, TypeNode, NamedTypeNode } from "graphql";
import { isCollection, getNamedTypeNode } from "./schemaUtil";

export function createInputType(ast: DocumentNode, locales: string[]): DocumentNode {
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
			if (
				node.name.value === 'Query' || 
				node.name.value === 'Mutation' || 
				node.name.value === 'Subscription'
			) {
				return;
			}
			if (isCollection(node)) {
				collectionTypes.push(node.name.value);
			}
			const inputType: InputObjectTypeDefinitionNode = {
				kind: 'InputObjectTypeDefinition',
				name: { kind: 'Name', value: `${node.name.value}Input` },
				directives: node.directives || [],
				fields: (node.fields || []).reduce((fields, field) => {
					if (
						field.name.value !== 'id' &&
						(
							field.directives === undefined ||
							field.directives.find(directive => directive.name.value === 'computed') === undefined
						)
					) {
						if (field.directives && field.directives.find(directive => directive.name.value === 'localized')) {
							const typeName = getNamedTypeNode(field.type);
							if (!localizedTypes.includes(typeName.name.value)) {
								localizedTypes.push(typeName.name.value);
							}
						}
						fields.push({
							kind: 'InputValueDefinition',
							name: field.name,
							type: field.type,
							directives: field.directives
						});
					}
					return fields;
				}, [] as InputValueDefinitionNode[])
			};
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
				fields: (node.types || []).reduce((fields, type) => {
					const inputType = inputTypes.get(type.name.value);
					if (inputType) {
						fields.push(...(inputType.fields || []).map(field => {
							// @ts-ignore
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
			};
			inputTypes.set(node.name.value, inputType);
		}
	});

	// Convert localized types
	localizedTypes.forEach(typeName => {
		const localizedName = `L${typeName}Input`;
		inputTypes.set(`L${typeName}`, {
			kind: 'InputObjectTypeDefinition',
			name: { kind: 'Name', value: localizedName },
			fields: locales.reduce((fields, code) => {
				fields.push({
					kind: 'InputValueDefinition',
					name: { kind: 'Name', value: code },
					type: { kind: 'NonNullType', type: { kind: 'NamedType', name: { kind: 'Name', value: typeName } } }
				});
				return fields;
			}, [] as InputValueDefinitionNode[])
		});
	});

	// Convert field type to their corresponding input type or ID if they reference a collection type
	inputTypes.forEach(node => {
		// @ts-ignore
		node.directives = undefined;
		// @ts-ignore
		node.fields.forEach(field => {
			// @ts-ignore
			field.type = transformType(
				field.type,
				field.directives && field.directives.find(directive => directive.name.value === 'localized') !== undefined
			);
			// @ts-ignore
			field.directives = undefined;
		});
		// @ts-ignore
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