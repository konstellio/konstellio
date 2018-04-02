import { Plugin, PluginInitContext, IResolvers } from './plugin';
import { DocumentNode, Kind, FieldDefinitionNode, ObjectTypeDefinitionNode, TypeExtensionDefinitionNode, StringValueNode, TypeNode, DefinitionNode, ArgumentNode, ValueNode, ListValueNode, ObjectValueNode, TypeDefinitionNode, UnionTypeDefinitionNode, NonNullTypeNode, ListTypeNode } from 'graphql';
import { parse } from 'graphql/language/parser';
import { visit } from 'graphql/language/visitor';
import { DirectiveNode } from 'graphql';

/*
 * Get Schemas from Plugins
 */
export async function getSchemaDocument(context: PluginInitContext, plugins: Plugin[]): Promise<DocumentNode> {
	const schemas = await Promise.all(plugins.map<Promise<string>>(plugin => plugin && plugin.graphql ? plugin.graphql(context) : Promise.resolve('')));
	return parse(schemas.join(`\n`), { noLocation: true });
}

/*
 * Get Resolvers from Plugins
 */
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
	shapes: Shape[]
	indexes: Index[]
}

export interface Shape {
	handle: string
	label?: string
	description?: string
	fields: Field[]
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
	condition?: string
}

export interface FieldRelation extends FieldBase {
	schema: string
	multiple: boolean
}

export interface Index {
	handle: string
	type: string
	fields: { [fieldHandle: string]: 'asc' | 'desc' }
}

/*
 * Get exact Value from ValueNode
 */
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

/*
 * Build argument object from ArgumentNodes
 */
export function getArgumentsValues(nodes: ArgumentNode[]): { [key: string]: any } {
	return nodes.reduce((args, arg) => {
		args[arg.name.value] = getValue(arg.value);
		return args;
	}, {});
}

/*
 * Parse DocumentNode into a list of Schema
 */
export function parseSchema(ast: DocumentNode): Schema[] {
	const schemas: { [key: string]: Schema } = {};
	const temps: { [key: string]: Schema } = {};
	const unions: { [key: string]: string[] } = {};

	function getNamedType(type: TypeNode): string {
		if (type.kind === 'NamedType') {
			return type.name.value;
		}
		return getNamedType(type.type);
	}

	function isTypeExtension(node: DefinitionNode): node is TypeDefinitionNode {
		return node.kind === 'TypeExtensionDefinition';
	}

	function isNonNullType(arg: TypeNode): arg is NonNullTypeNode {
		return arg.kind === 'NonNullType';
	}

	function isListType(arg: TypeNode): arg is ListTypeNode {
		return arg.kind === 'ListType';
	}

	function isStringValue(arg: ValueNode): arg is StringValueNode {
		return arg.kind === 'StringValue';
	}

	function isListValue(arg: ValueNode): arg is ListValueNode {
		return arg.kind === 'ListValue';
	}

	function isObjectValue(arg: ValueNode): arg is ObjectValueNode {
		return arg.kind === 'ObjectValue';
	}

	function extendSchema(dest: Schema, ext: Schema): Schema {
		dest.handle = ext.handle || dest.handle;
		dest.label = ext.label || dest.label;
		dest.description = ext.description || dest.description;
		dest.indexes = dest.indexes.concat(ext.indexes);
		dest.shapes[0].handle = ext.shapes[0].handle || dest.shapes[0].handle;
		dest.shapes[0].label = ext.shapes[0].label || dest.shapes[0].label;
		dest.shapes[0].description = ext.shapes[0].description || dest.shapes[0].description;
		dest.shapes[0].fields = dest.shapes[0].fields.concat(ext.shapes[0].fields);

		return dest;
	}

	visit(ast, {
		[Kind.UNION_TYPE_DEFINITION](node: UnionTypeDefinitionNode, key: string, parent: any) {
			const record = node.directives && node.directives.find(directive => directive.name.value === 'record');
			if (record) {
				const name = node.name.value;
				unions[name] = node.types.map(type => getNamedType(type));

				const args = record.arguments ? getArgumentsValues(record.arguments) : {};

				temps[name] = {
					handle: name,
					label: args.label || name,
					description: args.description || '',
					shapes: [],
					indexes: []
				}
			}
		},
		[Kind.OBJECT_TYPE_DEFINITION](node: ObjectTypeDefinitionNode, key: string, parent: DefinitionNode) {
			// that has a @model directive
			const record = node.directives && node.directives.find(directive => directive.name.value === 'record');
			if (record) {
				const name = node.name.value;
				// Extract arguments
				const args = record.arguments ? getArgumentsValues(record.arguments) : {};
				// Extract fields
				const fields = node.fields.map<Field | undefined>(definition => {
					const field = definition.directives && definition.directives.find(directive => directive.name.value === 'field');
					if (field) {
						const args = field.arguments ? getArgumentsValues(field.arguments) : {};
						if (args.type === 'relation') {
							return Object.assign({
								handle: definition.name.value,
								field: 'text',
								group: 'default',
								label: definition.name.value,
								required: definition.type.kind === 'NonNullType'
							}, args, {
								schema: getNamedType(definition.type),
								multiple: isNonNullType(definition.type) && isListType(definition.type.type)
							}) as FieldRelation;
						} else {
							return Object.assign({
								handle: definition.name.value,
								type: 'text',
								field: 'text',
								group: 'default',
								label: definition.name.value,
								required: definition.type.kind === 'NonNullType'
							}, args) as FieldBase;
						}
					}
					return undefined;
				}).filter<Field>((schema): schema is Field => schema !== undefined);

				// Extract indexes
				const indexes = args.indexes && args.indexes.map(index => {
					return Object.assign({
						handle: '',
						type: 'index',
						fields: []
					}, index);
				}) || [];

				// Parent is a extension type
				if (isTypeExtension(parent)) {
					// Extend existing Schema
					if (typeof schemas[name] !== 'undefined') {
						schemas[name] = extendSchema(schemas[name], {
							handle: name,
							label: args.label || name,
							description: args.description || '',
							shapes: [{
								handle: name,
								label: args.label || name,
								description: args.description || '',
								fields: fields
							}],
							indexes
						});
					}
					// Extend a type that was previously extended
					else if (typeof temps[name] !== 'undefined') {
						temps[name] = extendSchema(temps[name], {
							handle: name,
							label: args.label || name,
							description: args.description || '',
							shapes: [{
								handle: name,
								label: args.label || name,
								description: args.description || '',
								fields: fields
							}],
							indexes
						})
					}
					// Remember this extension
					else {
						temps[name] = {
							handle: name,
							label: args.label || name,
							description: args.description || '',
							shapes: [{
								handle: name,
								label: args.label || name,
								description: args.description || '',
								fields: fields
							}],
							indexes: indexes
						}
					}
				}
				// Is a Object definition
				else {
					schemas[name] = {
						handle: name,
						label: args.label || name,
						description: args.description || '',
						shapes: [{
							handle: name,
							label: args.label || name,
							description: args.description || '',
							fields: fields.concat([{
								handle: 'id',
								type: 'text',
								field: 'text',
								required: true
							}])
						}],
						indexes: indexes
					};
					if (typeof temps[name] !== 'undefined') {
						schemas[name] = extendSchema(schemas[name], temps[name]);
					}
				}
			}
		}
	});

	for (let handle in unions) {
		const records = unions[handle].map(record => schemas[record]);

		unions[handle].forEach(record => {
			delete schemas[record];
		});

		schemas[handle] = records.reduce((schema, record) => {
			schema.indexes = schema.indexes.concat(record.indexes);
			schema.shapes = schema.shapes.concat(record.shapes);
			return schema;
		}, temps[handle]);

		schemas[handle].shapes = schemas[handle].shapes.reduce((shapes, shape) => {
			shape.fields.push({
				handle: '__type',
				type: 'text',
				field: 'text',
				required: true
			})
			return shapes;
		}, schemas[handle].shapes);
	}

	for (let handle in schemas) {
		schemas[handle].indexes = schemas[handle].indexes.concat([{
			handle: `${handle}_id`,
			type: 'primary',
			fields: { id: 'asc' }
		}]);
	}


	return Object.values(schemas);
}