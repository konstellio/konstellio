import { DefinitionNode, Kind, TypeNode, NamedTypeNode, DirectiveNode } from "graphql";

export function isCollection(node: DefinitionNode): boolean {
	return (node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.UNION_TYPE_DEFINITION) &&
		node.directives !== undefined &&
		node.directives!.find(d => d.name.value === 'collection') !== undefined;
}

export function isComputed(node: { directives?: ReadonlyArray<DirectiveNode> }): boolean {
	return (node.directives || []).find(directive => directive.name.value === 'computed') !== undefined;
}

export function isLocalized(node: { directives?: ReadonlyArray<DirectiveNode> }): boolean {
	return (node.directives || []).find(directive => directive.name.value === 'localized') !== undefined;
}

export function isInlined(node: { directives?: ReadonlyArray<DirectiveNode> }): boolean {
	return (node.directives || []).find(directive => directive.name.value === 'localized') !== undefined;
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

export function getNamedTypeNode(type: TypeNode): NamedTypeNode {
	if (type.kind === Kind.NAMED_TYPE) {
		return type;
	}
	return getNamedTypeNode(type.type);
}

export function isSpecifiedScalarType(type: NamedTypeNode): boolean {
	return type.name.value === 'String'
		|| type.name.value === 'Int'
		|| type.name.value === 'Float'
		|| type.name.value === 'Boolean';
}

export function isSpecifiedExtendedScalarType(type: NamedTypeNode): boolean {
	return type.name.value === 'ID'
		|| type.name.value === 'String'
		|| type.name.value === 'Int'
		|| type.name.value === 'Float'
		|| type.name.value === 'Boolean'
		|| type.name.value === 'Date'
		|| type.name.value === 'DateTime'
		|| type.name.value === 'Cursor';
}