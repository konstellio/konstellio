import { DocumentNode, visit } from "graphql";
import { isCollection, isNonNullType, isListType, getNamedTypeNode, isComputed, isLocalized, isSpecifiedExtendedScalarType } from "./schemaUtil";


export function generatorTypescript(document: DocumentNode, locales: string[]): string {
	let types = '';

	const enums: Map<string, string> = new Map();
	const enumUsed: string[] = [];

	visit(document, {
		InterfaceTypeDefinition: {
			enter(node) {
				types += `export interface ${node.name.value} {\n`;
			},
			leave(node) {
				types += `}\n\n`;
			}
		},
		ObjectTypeDefinition: {
			enter(node) {
				types += `export interface ${node.name.value}${node.interfaces && node.interfaces.length ? ` extends ${node.interfaces.map(inter => inter.name.value).join(', ')}` : ''} {\n`;
			},
			leave(node) {
				types += `}\n\n`;
			}
		},
		UnionTypeDefinition: {
			enter(node) {
				if (node.types) {
					types += `export type ${node.name.value} = 
	${node.types.map(type => type.name.value).join(` |\n\t`)};`;
				}
				return false;
			},
			leave(node) {

			}
		},
		InputObjectTypeDefinition: {
			enter(node) {
				types += `export interface ${node.name.value} {\n`;
			},
			leave(node) {
				types += `}\n\n`;
			}
		},
		InputValueDefinition: {
			enter(node) {
				const type = getNamedTypeNode(node.type);
				const isRequired = isNonNullType(node.type);
				const isList = isListType(node.type);
				const isRelation = false;
				types += `\t${node.name.value}${isRequired ? '' : '?'}: ${isRelation ? `ID` : type.name.value}${isList ? `[]` : ''}\n`;
			}
		},
		FieldDefinition: {
			enter(node) {
				const type = getNamedTypeNode(node.type);
				if (!isComputed(node)) {
					const isRequired = isNonNullType(node.type);
					const isList = isListType(node.type);
					const isRelation = !isSpecifiedExtendedScalarType(type);
					types += `\t${node.name.value}${isRequired ? '' : '?'}: ${isRelation ? `ID` : type.name.value}${isList ? `[]` : ''}\n`;
				}
			}
		},
		ScalarTypeDefinition: {
			enter(node) {
				if (node.name.value === 'DateTime') {
					types += `export type ${node.name.value} = Date;\n\n`;
				}
				else if (node.name.value === 'Float') {
					types += `export type ${node.name.value} = Number;\n\n`;
				}
				else if (node.name.value !== 'Date') {
					types += `export type ${node.name.value} = any;\n\n`;
				}
			}
		},
		EnumTypeDefinition: {
			enter(node) {
				debugger;
				enums.set(node.name.value, `export enum ${node.name.value} {
 	${(node.values || []).map(value => `${value.name.value} = ${value.name.value}`).join(`,\n\t`)}
}\n\n`);
			}
		}
	});

	return types;
}