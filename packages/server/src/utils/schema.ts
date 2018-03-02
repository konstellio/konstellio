import { Plugin, PluginInitContext, IResolvers } from './plugin';
import { DocumentNode, Kind, FieldDefinitionNode, ObjectTypeDefinitionNode, TypeExtensionDefinitionNode, StringValueNode, TypeNode, DefinitionNode, ArgumentNode, ValueNode, ListValueNode, ObjectValueNode, TypeDefinitionNode } from 'graphql';
import { parse } from 'graphql/language/parser';
import { visit } from 'graphql/language/visitor';
import { DirectiveNode } from 'graphql';
import { DescribeCollectionQueryResult, ColumnType, IndexType } from '@konstellio/db';

export async function getSchemaDocument(context: PluginInitContext, plugins: Plugin[]): Promise<DocumentNode> {
	const schemas = await Promise.all(plugins.map<Promise<string>>(plugin => plugin && plugin.graphql ? plugin.graphql(context) : Promise.resolve('')));
	return parse(schemas.join(`\n`), { noLocation: true });
}

export async function getSchemaResolvers(plugins: Plugin[]): Promise<IResolvers> {
	return plugins.reduce((resolvers, plugin) => {
		Object.keys(plugin.resolvers || {}).forEach(key => {
			resolvers[key] = resolvers[key] || {};
			Object.assign(resolvers[key], plugin.resolvers![key]);
		});
		return resolvers;
	}, {} as IResolvers);
}

export interface Schema {
	handle: string
	label?: string
	description?: string
	fields: Field[]
	indexes: Index[]
}

export type Field = FieldBase | FieldRelation;

export interface FieldBase {
	handle: string
	type: string
	field: string
	group?: string
	label?: string
	description?: string
	localized?: boolean
	required?: boolean
}

export interface FieldRelation extends FieldBase {
	model: string
}

export interface Index {
	handle: string
	type: string
	fields: { [fieldHandle: string]: 'asc' | 'desc' }
}

export function getValue(node: ValueNode): any {
	if (node.kind === Kind.VARIABLE) {
		return 1;
	}
	else if (node.kind === Kind.LIST) {
		return node.values.map(getValue);
	}
	else if (node.kind === Kind.OBJECT) {
		return node.fields.reduce((obj, field) => {
			obj[field.name.value] = getValue(field.value);
			return obj;
		}, {});
	}
	else if (node.kind === Kind.NULL) {
		return 2;
	}
	else {
		return node.value;
	}
}

export function getArgumentsValues(nodes: ArgumentNode[]): { [key: string]: any } {
	return nodes.reduce((args, arg) => {
		args[arg.name.value] = getValue(arg.value);
		return args;
	}, {});
}

export function parseSchema(ast: DocumentNode): Schema[] {
	const models: { [key: string]: Schema } = {};
	const temps: { [key: string]: Schema } = {};

	function getNamedType(type: TypeNode): string {
		if (type.kind === "NamedType") {
			return type.name.value;
		}
		return getNamedType(type.type);
	}

	function isTypeExtension(node: DefinitionNode): node is TypeDefinitionNode {
		return node.kind === "TypeExtensionDefinition";
	}

	function isStringValue(arg: ValueNode): arg is StringValueNode {
		return arg.kind === "StringValue";
	}

	function isListValue(arg: ValueNode): arg is ListValueNode {
		return arg.kind === "ListValue";
	}

	function isObjectValue(arg: ValueNode): arg is ObjectValueNode {
		return arg.kind === "ObjectValue";
	}

	visit(ast, {
		[Kind.OBJECT_TYPE_DEFINITION](node: ObjectTypeDefinitionNode, key: string, parent: DefinitionNode) {
			const model = node.directives && node.directives.find(directive => directive.name.value === 'model');
			if (model) {
				const args = model.arguments ? getArgumentsValues(model.arguments) : {};
				const name = node.name.value;
				const fields = node.fields.map<Field | undefined>(definition => {
					const field = definition.directives && definition.directives.find(directive => directive.name.value === 'field');
					if (field) {
						const args = field.arguments ? getArgumentsValues(field.arguments) : {};
						return Object.assign({
							handle: definition.name.value,
							type: getNamedType(definition.type),
							field: "text",
							group: "default",
							label: definition.name.value,
							required: definition.type.kind === 'NonNullType'
						}, args);
					}
					return undefined;
				}).filter<Field>((schema): schema is Field => schema !== undefined);

				const indexes = args.indexes && args.indexes.map(index => {
					return Object.assign({
						handle: '',
						type: 'index',
						fields: []
					}, index);
				}) || [];

				if (isTypeExtension(parent)) {
					if (typeof models[name] !== "undefined") {
						models[name].label = args.label || models[name].label;
						models[name].description = args.description || models[name].description;
						models[name].fields = models[name].fields.concat(fields);
						models[name].indexes = models[name].indexes.concat(indexes);
					} else {
						temps[name] = {
							handle: name,
							label: args.label || name,
							description: args.description || "",
							fields: fields,
							indexes: indexes
						}
					}
				} else {
					models[name] = {
						handle: name,
						label: args.label || name,
						description: args.description || typeof temps[name] !== "undefined" && temps[name].description || "",
						fields: (typeof temps[name] !== "undefined" ? fields.concat(temps[name].fields) : fields).concat([{
							handle: 'id',
							type: 'text',
							field: 'text'
						}]),
						indexes: (typeof temps[name] !== "undefined" ? indexes.concat(temps[name].indexes) : indexes).concat([{
							handle: `${name}_id`,
							type: 'primary',
							fields: { id: 'asc' }
						}])
					};
				}
			}
		}
	});

	return Object.values(models);
}