import { DocumentNode, visit } from "graphql";
import { isCollection, isNonNullType, isListType, getNamedTypeNode, isSpecifiedScalarType, isComputed, isLocalized } from "./schemaUtil";


export function generatorTypescript(document: DocumentNode, locales: string[]): string {
	let types = '';

	const enums: Map<string, string> = new Map();
	const enumUsed: string[] = [];

	visit(document, {
		InterfaceTypeDefinition: {
			enter(node) {
				types += `declare interface ${node.name.value} {\n`;
			},
			leave(node) {
				types += `}\n\n`;
			}
		},
		ObjectTypeDefinition: {
			enter(node) {
				if (isCollection(node)) {
					types += `declare interface ${node.name.value}${node.interfaces && node.interfaces.length ? ` extends ${node.interfaces.map(inter => inter.name.value).join(', ')}` : ''} {\n`;
				} else {
					return false;
				}
			},
			leave(node) {
				if (isCollection(node)) {
					types += `}\n\n`;
				}
			}
		},
		UnionTypeDefinition: {
			enter(node) {
				if (node.types) {
					types += `declare type ${node.name.value} = 
	${node.types.map(type => type.name.value).join(` |\n\t`)};`;
				}
				return false;
			},
			leave(node) {

			}
		},
		FieldDefinition: {
			enter(node) {
				const type = getNamedTypeNode(node.type);
				if (!isComputed(node)) {
					const isRequired = isNonNullType(node.type);
					const isList = isListType(node.type);
					const isRelation = !isSpecifiedScalarType(type);
					types += `\t${node.name.value}${isRequired ? '' : '?'}: ${isRelation ? `ID` : type.name.value}${isList ? `[]` : ''}\n`;
				}
			}
		},
		ScalarTypeDefinition: {
			enter(node) {
				if (node.name.value === 'DateTime') {
					types += `declare type ${node.name.value} = Date;\n\n`;
				}
				else if (node.name.value !== 'Date') {
					types += `declare type ${node.name.value} = any;\n\n`;
				}
			}
		},
		EnumTypeDefinition: {
			enter(node) {
				enums.set(node.name.value, `declare enum ${node.name.value} {
 	${(node.values || []).map(value => `${value.name.value} = ${value.name.value}`).join(`,\n\t`)}
}\n\n`);
			}
		}
	});

	visit(document, {
		InterfaceTypeDefinition: {
			enter(node) {
				types += `declare interface ${node.name.value}Input {\n`;
			},
			leave(node) {
				types += `}\n\n`;
			}
		},
		ObjectTypeDefinition: {
			enter(node) {
				if (isCollection(node)) {
					types += `declare interface ${node.name.value}Input${node.interfaces && node.interfaces.length ? ` extends ${node.interfaces.map(inter => `${inter.name.value}Input`).join(', ')}` : ''} {\n`;
				} else {
					return false;
				}
			},
			leave(node) {
				if (isCollection(node)) {
					types += `}\n\n`;
				}
			}
		},
		UnionTypeDefinition: {
			enter(node) {
				if (node.types) {
					types += `declare type ${node.name.value} = 
	${node.types.map(type => `${type.name.value}Input`).join(` |\n\t`)};`;
				}
				return false;
			},
			leave(node) {

			}
		},
		FieldDefinition: {
			enter(node) {
				const type = getNamedTypeNode(node.type);
				if (!isComputed(node)) {
					const localized = isLocalized(node);
					const required = isNonNullType(node.type);
					const asArray = isListType(node.type);
					const relation = !isSpecifiedScalarType(type);
					if (localized) {
						types += `\t${node.name.value}${required ? '' : '?'}: {
		${locales.map(locale => `${locale}: ${relation ? `ID` : type.name.value}${asArray ? `[]` : ''}`).join(`\n\t\t`)}
	}\n`;
					} else {
						types += `\t${node.name.value}${required ? '' : '?'}: ${relation ? `ID` : type.name.value}${asArray ? `[]` : ''}\n`;
					}
				}
			}
		},
	});

	return types;
}