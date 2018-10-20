import { DocumentNode, concatAST, DefinitionNode, Kind, TypeDefinitionNode, FieldDefinitionNode, TypeNode, ArgumentNode, ValueNode, DirectiveNode } from "graphql";

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

/**
 * Merge multiple DocumentNode into one, collapsing type extension into their type definition
 */
export function mergeAST(documents: DocumentNode[]): DocumentNode {
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

	return {
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
}

export function getDefNodeByNamedType(ast: DocumentNode, name: string): DefinitionNode | undefined {
	return ast.definitions.find((def: any) => (
		// isTypeExtensionNode(def) === false &&
		def.name && def.name.value === name
	));
}

export function isTypeDefinitionNode(node: any): node is TypeDefinitionNode {
	return node && node.kind && (
		node.kind === Kind.SCALAR_TYPE_DEFINITION ||
		node.kind === Kind.OBJECT_TYPE_DEFINITION ||
		node.kind === Kind.INTERFACE_TYPE_DEFINITION ||
		node.kind === Kind.UNION_TYPE_DEFINITION ||
		node.kind === Kind.ENUM_TYPE_DEFINITION ||
		node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
	);
}

// TODO: Add types when @types/graphql will get updated...
// function isTypeExtensionNode(node: any): node is TypeExtensionNode {
export function isTypeExtensionNode(node: any): boolean {
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

export function buildTypeName(type: TypeNode): string {
	if (type.kind === Kind.LIST_TYPE) {
		return `List${buildTypeName(type.type)}`;
	}
	else if (type.kind === Kind.NON_NULL_TYPE) {
		return `Req${buildTypeName(type.type)}`;
	}
	else {
		return type.name.value;
	}
}

export function isCollection(node: DefinitionNode): boolean {
	return (node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.UNION_TYPE_DEFINITION) &&
		node.directives !== undefined &&
		node.directives!.find(d => d.name.value === 'collection') !== undefined;
}

export function isComputedField(node: FieldDefinitionNode): boolean {
	return node.directives !== undefined && ((node.arguments || []).length > 0 || node.directives!.find(d => d.name.value === 'computed') !== undefined);
}

export function isLocalizedField(node: FieldDefinitionNode): boolean {
	return node.directives !== undefined && node.directives!.find(d => d.name.value === 'localized') !== undefined;
}

export function isInlinedField(node: FieldDefinitionNode): boolean {
	return node.directives !== undefined && node.directives!.find(d => d.name.value === 'inlined') !== undefined;
}

export function getNamedTypeNode(type: TypeNode): string {
	if (type.kind === Kind.NAMED_TYPE) {
		return type.name.value;
	}
	return getNamedTypeNode(type.type);
}

export function isNonNullType(type: TypeNode): boolean {
	if (type.kind === Kind.NON_NULL_TYPE) {
		return true;
	}
	else if (type.kind === Kind.LIST_TYPE) {
		return isNonNullType(type.type);
	}
	return false;
}

export function isListType(type: TypeNode): boolean {
	if (type.kind === Kind.LIST_TYPE) {
		return true;
	}
	else if (type.kind === Kind.NON_NULL_TYPE) {
		return isListType(type.type);
	}
	return false;
}

export function getValue(node: ValueNode): any {
	if (node.kind === Kind.VARIABLE) {
		return null;
	}
	else if (node.kind === Kind.LIST) {
		return node.values.map(getValue);
	}
	else if (node.kind === Kind.OBJECT) {
		return node.fields.reduce((obj, field) => {
			obj[field.name.value] = getValue(field.value);
			return obj;
		}, {} as { [name: string]: any });
	}
	else if (node.kind === Kind.NULL) {
		return null;
	}
	else {
		return node.value;
	}
}

export function getArgumentsValues(nodes: ReadonlyArray<ArgumentNode> | undefined): { [key: string]: any } {
	if (nodes === undefined) return {};
	return nodes.reduce((args, arg) => {
		args[arg.name.value] = getValue(arg.value);
		return args;
	}, {} as { [name: string]: any });
}