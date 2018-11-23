import { DocumentNode, visit, BREAK, Kind } from "graphql";
import { isCollection, getNamedTypeNode, isSpecifiedScalarType } from "./schemaUtil";


export function trimDocument(document: DocumentNode): DocumentNode {
	const namedNodeDeps: string[] = [];
	const leftToScan: string[] = [];

	visit(document, {
		ObjectTypeDefinition(node) {
			if (isCollection(node)) {
				leftToScan.push(node.name.value);
			}
		},
		UnionTypeDefinition(node) {
			if (isCollection(node)) {
				leftToScan.push(node.name.value);
			}
		}
	});

	while (leftToScan.length > 0) {
		const currentNodeToScan = leftToScan.shift()!;
		visit(document, {
			InterfaceTypeDefinition(node) {
				if (node.name.value === currentNodeToScan) {
					namedNodeDeps.push(node.name.value);
					if (node.fields) {
						node.fields.forEach(field => {
							const type = getNamedTypeNode(field.type);
							if (!isSpecifiedScalarType(type)) {
								leftToScan.push(type.name.value);
							}
						});
					}
					return BREAK;
				}
			},
			ObjectTypeDefinition(node) {
				if (node.name.value === currentNodeToScan) {
					namedNodeDeps.push(node.name.value);
					if (node.interfaces) {
						leftToScan.push(...node.interfaces.map(inter => inter.name.value));
					}
					if (node.fields) {
						node.fields.forEach(field => {
							const type = getNamedTypeNode(field.type);
							if (!isSpecifiedScalarType(type)) {
								leftToScan.push(type.name.value);
							}
						});
					}
					return BREAK;
				}
			},
			UnionTypeDefinition(node) {
				if (node.name.value === currentNodeToScan) {
					namedNodeDeps.push(node.name.value);
					if (node.types) {
						leftToScan.push(...node.types.map(type => type.name.value));
					}
					return BREAK;
				}
			},
			InputObjectTypeDefinition(node) {
				if (node.name.value === currentNodeToScan) {
					namedNodeDeps.push(node.name.value);
					if (node.fields) {
						node.fields.forEach(field => {
							const type = getNamedTypeNode(field.type);
							if (!isSpecifiedScalarType(type)) {
								leftToScan.push(type.name.value);
							}
						});
					}
					return BREAK;
				}
			},
			EnumTypeDefinition(node) {
				if (node.name.value === currentNodeToScan) {
					namedNodeDeps.push(node.name.value);
					return BREAK;
				}
			},
			ScalarTypeDefinition(node) {
				if (node.name.value === currentNodeToScan) {
					namedNodeDeps.push(node.name.value);
					return BREAK;
				}
			}
		});
	}

	return visit(document, {
		enter(node) {
			if (
				node.kind === Kind.INTERFACE_TYPE_DEFINITION || 
				node.kind === Kind.OBJECT_TYPE_DEFINITION || 
				node.kind === Kind.UNION_TYPE_DEFINITION || 
				node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
				node.kind === Kind.ENUM_TYPE_DEFINITION ||
				node.kind === Kind.SCALAR_TYPE_DEFINITION
			) {
				if (!namedNodeDeps.includes(node.name.value)) {
					return null;
				}
			}
			else if (
				node.kind === Kind.DIRECTIVE_DEFINITION
			) {
				return null;
			}
		}
	});
}