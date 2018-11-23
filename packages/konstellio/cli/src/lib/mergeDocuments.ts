import { DocumentNode, concatAST, DefinitionNode, Kind, TypeDefinitionNode, FieldDefinitionNode, TypeNode, ArgumentNode, ValueNode, DirectiveNode, TypeExtensionNode, visit } from "graphql";
import { getNamedTypeNode } from "./schemaUtil";

/**
 * Merge multiple DocumentNode into one, collapsing type extension into their type definition
 */
export function mergeDocuments(documents: DocumentNode[]): DocumentNode {
	const concat = concatAST(documents);
	const nodeDefMap: Map<string, any> = new Map();
	const nodeExtMap: Map<string, any[]> = new Map();

	concat.definitions.forEach(node => {
		const name = (node as any).name.value;
		if (isTypeExtensionNode(node)) {
			if (!nodeExtMap.has(name)) {
				nodeExtMap.set(name, []);
			}
			nodeExtMap.get(name)!.push(node);
		} else {
			nodeDefMap.set(name, node);
		}
	});

	const mergedDocument = {
		kind: concat.kind,
		definitions: concat.definitions.reduce((definitions, node) => {
			if (isTypeDefinitionNode(node)) {
				const extensions = nodeExtMap.get(node.name.value);
				if (extensions) {
					if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
						definitions.push({
							...node,
							interfaces: (node.interfaces || []).concat(extensions.reduce((interfaces, ext) => { interfaces.push(...ext.interfaces); return interfaces; }, [])),
							directives: mergeDirectives((node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, []))),
							fields: (node.fields || []).concat(extensions.reduce((fields, ext) => { fields.push(...ext.fields); return fields; }, [])),
						});
					}
					else if (node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
						definitions.push({
							...node,
							directives: mergeDirectives((node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, []))),
							fields: (node.fields || []).concat(extensions.reduce((fields, ext) => { fields.push(...ext.fields); return fields; }, [])),
						});
					}
					else if (node.kind === Kind.ENUM_TYPE_DEFINITION) {
						definitions.push({
							...node,
							directives: mergeDirectives((node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, []))),
							values: (node.values || []).concat(extensions.reduce((values, ext) => { values.push(...ext.values); return values; }, [])),
						});
					}
					else if (node.kind === Kind.UNION_TYPE_DEFINITION) {
						definitions.push({
							...node,
							directives: mergeDirectives((node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, []))),
							types: (node.types || []).concat(extensions.reduce((types, ext) => { types.push(...ext.types); return types; }, [])),
						});
					}
					else if (node.kind === Kind.SCALAR_TYPE_DEFINITION) {
						// FIXME: Extend scalar type
						// definitions.push({
						// 	...node,
						// 	directives: (node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, [])),
						// 	types: (node.types || []).concat(extensions.reduce((types, ext) => { types.push(...ext.types); return types; }, [])),
						// });
					}
				} else {
					definitions.push(node);
				}
			}
			else if (isTypeExtensionNode(node) && !nodeDefMap.has((node as any).name.value)) {
				definitions.push(node);
			}
			else if (node.kind === Kind.DIRECTIVE_DEFINITION) {
				definitions.push(node);
			}
			return definitions;
		}, [] as DefinitionNode[])
	};

	return visit(mergedDocument, {
		FieldDefinition: {
			enter(node) {
				if (node.name.value === '_ImATeaPot' && getNamedTypeNode(node.type).name.value === 'Boolean') {
					return null;
				}
			}
		},
		ObjectTypeDefinition: {
			leave(node) {
				if (!node.fields || node.fields.length === 0) {
					return null;
				}
			}
		}
	});
}

function isTypeDefinitionNode(node: any): node is TypeDefinitionNode {
	return node && node.kind && (
		node.kind === Kind.SCALAR_TYPE_DEFINITION ||
		node.kind === Kind.OBJECT_TYPE_DEFINITION ||
		node.kind === Kind.INTERFACE_TYPE_DEFINITION ||
		node.kind === Kind.UNION_TYPE_DEFINITION ||
		node.kind === Kind.ENUM_TYPE_DEFINITION ||
		node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
	);
}

function isTypeExtensionNode(node: any): node is TypeExtensionNode {
	return node && node.kind && (
		node.kind === 'TypeExtensionDefinition' || // remove this ?
		node.kind === 'ScalarTypeExtension' ||
		node.kind === 'ObjectTypeExtension' ||
		node.kind === 'InterfaceTypeExtension' ||
		node.kind === 'UnionTypeExtension' ||
		node.kind === 'EnumTypeExtension' ||
		node.kind === 'InputObjectTypeExtension'
	);
}

function mergeDirectives(directives: ReadonlyArray<DirectiveNode>): ReadonlyArray<DirectiveNode> {
	let indexesDirective: DirectiveNode | undefined;
	return directives.reduce((directives, directive) => {
		if (directive.name.value === 'collection') {
			if (!indexesDirective) {
				indexesDirective = directive;
				directives.push(directive);
			} else {
				const prevIndexes = (indexesDirective.arguments || []).find(arg => arg.name.value === 'indexes');
				const nextIndexes = (directive.arguments || []).find(arg => arg.name.value === 'indexes');
				if (prevIndexes && nextIndexes) {
					(prevIndexes.value as any).values.push(...(nextIndexes.value as any).values);
				}
			}
		} else {
			directives.push(directive);
		}
		return directives;
	}, [] as DirectiveNode[]);
}