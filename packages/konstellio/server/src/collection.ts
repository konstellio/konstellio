import { ObjectTypeDefinitionNode, UnionTypeDefinitionNode, Kind, DocumentNode, TypeNode, DefinitionNode, FieldDefinitionNode, InputObjectTypeDefinitionNode, InputValueDefinitionNode, NamedTypeNode } from "graphql";
import { Locales } from "./server";
import { Database, q, Field, FieldAs, BinaryExpression, FieldDirection, replaceField, Comparison, Collection as DBCollection } from "@konstellio/db";
import { isCollection, getValue, getDefNodeByNamedType, getNamedTypeNode, isComputedField, isLocalizedField, isListType } from "./utilities/ast";
import * as Joi from 'joi';
import { IResolvers } from "graphql-tools";
import { Schema as DataSchema } from "./utilities/migration";
import * as Dataloader from "dataloader";

const relationCollection = q.collection('Relation');

export type CollectionType = { id: string, [field: string]: any };

export class Collection<I, O extends CollectionType> {

	// @ts-ignore
	public static createTypeExtension(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): string {
		return '';
	}

	// @ts-ignore
	public static createResolvers(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): IResolvers {
		return {};
	}
	
	public readonly name: string;
	
	private readonly collection: DBCollection;
	private readonly defaultLocale: string;
	private readonly validation: Joi.Schema;
	private readonly loader: Dataloader<{ id: string, locale?: string, fields?: (string | Field | FieldAs)[] }, O | undefined>;
	private readonly fields: FieldMeta[];
	private readonly fieldMap: Map<string, Map<Field, Field>>;

	constructor(
		public readonly driver: Database,
		public readonly locales: Locales,
		ast: DocumentNode,
		node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode
	) {
		this.name = node.name.value;
		this.collection = q.collection(this.name);
		this.defaultLocale = Object.keys(locales).shift()!;
		this.validation = createValidationSchemaFromDefinition(ast, node, locales);

		this.fields = node.kind === 'ObjectTypeDefinition'
			? gatherObjectFields(ast, node)
			: (node.types || []).reduce((fields, type) => {
				const node = getDefNodeByNamedType(ast, type.name.value);
				if (node && node.kind === 'ObjectTypeDefinition') {
					fields.push(...gatherObjectFields(ast, node));
				}
				return fields;
			}, [] as FieldMeta[]);

		this.fieldMap = new Map<string, Map<Field, Field>>(Object.keys(locales).map(code => [
			code,
			new Map<Field, Field>(this.fields.reduce((fields, field) => {
				if (field.isRelation && driver.features.join) {
					fields.push([
						q.field(field.handle),
						q.field('target', `ref__${field.handle}${field.isLocalized ? `__${code}` : ''}`)
					]);
				} else {
					fields.push([
						q.field(field.handle),
						q.field(field.isLocalized ? `${field.handle}__${code}` : field.handle)
					]);
				}
				return fields;
			}, [] as [Field, Field][]))
		]) as [string, Map<Field, Field>][]);

		let batchedFields: (Field | FieldAs)[] = [];
		this.loader = new Dataloader(
			async (keys) => {
				const ids = keys.map(key => key.id);
				const uids = ids.filter((id, pos, ids) => ids.indexOf(id) === pos);
				const fields = batchedFields.concat([q.field('id')]);
				// const fields = batchedFields.length > 0 ? batchedFields : undefined;
				batchedFields = [];

				const results = await this.find({
					fields,
					condition: q.in('id', uids)
				});

				return ids.map(id => {
					const res = results.filter(result => result.id === id);
					return res.length === 1 ? res[0] : undefined;
				});
			}, {
				cache: false,
				cacheKeyFn(key: { id: string, locale?: string, fields?: (Field | FieldAs)[] }) {
					const { id, fields } = key;
					// TODO: use locale...
					if (fields) {
						batchedFields.push(...fields);
					}
					return id;
				}
			}
		);
	}

	async findById(
		id: string,
		{ locale, fields }: { locale?: string, fields?: (string | Field | FieldAs)[] }
	): Promise<O> {
		try {
			const result = await this.loader.load({ id, locale, fields });
			if (result) {
				return result;
			}
		} catch (err) { }
		throw new Error(`Could not find ID ${id} in ${this.name}.`);
	}

	async findByIds(
		ids: string[],
		{ locale, fields }: { locale?: string, fields?: (string | Field)[] }
	): Promise<O[]> {
		try {
			const results = await this.loader.loadMany(ids.map(id => ({ id, locale, fields })));
			const realResults = results.filter((result): result is O => result !== undefined);
			if (realResults.length === ids.length) {
				return realResults;
			}
		} catch (err) { }
		throw new Error(`Could not find IDs ${ids.join(', ')} in ${this.name}.`);
	}

	async findOne(
		options: { locale?: string, fields?: (Field | FieldAs)[], condition?: BinaryExpression, sort?: FieldDirection[], offset?: number }
	): Promise<O> {
		const results = await this.find({
			...options,
			limit: 1
		});
		if (results.length === 0) {
			throw new Error(`Could not find anything matching query in ${this.name}.`);
		}
		return results[0];
	}

	async find(
		options: { locale?: string, fields?: (Field | FieldAs)[], condition?: BinaryExpression, sort?: FieldDirection[], offset?: number, limit?: number }
	): Promise<O[]> {
		return this.aggregate<O>(options);
	}

	async aggregate<T>(
		options: { locale?: string, fields?: (Field | FieldAs)[], condition?: BinaryExpression, group?: (Field | Function)[], sort?: FieldDirection[], offset?: number, limit?: number }
	): Promise<T[]> {
		const fieldsUsed: Field[] = [];
		const locale = options.locale || this.defaultLocale;
		const fieldMap = this.fieldMap.get(locale)!;
		const fields = options.fields || Array.from(fieldMap.keys());

		const selectUsed: Field[] = [];
		const selectAlias: FieldAs[] = fields.map(field => field instanceof Field ? q.as(field, field.name) : field);
		const select = replaceField(selectAlias, fieldMap, selectUsed) as FieldAs[];

		let query = q.aggregate(...select).from(this.collection).range({ limit: options.limit, offset: options.offset });
		if (options.condition) {
			query = query.where(replaceField((options.condition instanceof Comparison ? q.and(options.condition) : options.condition), fieldMap, fieldsUsed))
		}
		if (options.group) {
			query = query.group(...replaceField(options.group, fieldMap, fieldsUsed));
		}
		if (options.sort) {
			query = query.sort(...replaceField(options.sort, fieldMap, fieldsUsed));
		}

		if (this.driver.features.join) {
			const relations = fieldsUsed
				.map(field => [field, this.fields.find(f => f.handle === field.name)] as [Field, FieldMeta])
				.filter(([, meta]) => meta !== undefined && meta.isRelation);
			
			relations.forEach(([fieldUsed, meta]) => {
				// const localizedField = replaceField(fieldUsed, fieldMap) as Field;
				const field = fieldUsed.name;
				const alias = `ref__${field}`;
				// const relationCollection = q.collection(meta.type);

				query = query.join(
					alias,
					q.select('collection', 'field', 'source', 'target', 'seq').from(relationCollection).where(q.and(q.eq('collection', meta.type), q.eq('field', field))),
					q.eq(q.field('source', alias), q.field('id'))
				);
			});
		}
			
		const result = await this.driver.execute<T>(query);

		if (this.driver.features.join) {
			const relations = selectUsed
				.map(field => [field, this.fields.find(f => f.handle === field.name)] as [Field, FieldMeta])
				.filter(([, meta]) => meta !== undefined && meta.isRelation);
			
			if (relations.length) {
				// TODO: fetch relation if needed
				debugger;
			}
		}

		return result.results;
	}

	async create(
		data: I
	): Promise<string> {
		return '';
	}

	async replace(
		data: I
	): Promise<boolean> {
		return false;
	}

	async delete(
		ids: string[]
	): Promise<boolean> {
		return false;
	}

	public validate(data: any, errors: Error[] = []): data is I {
		if (typeof data !== 'object') {
			errors.push(new Error(`Expected data to be an object.`));
			return false;
		}

		const result = Joi.validate(data, this.validation);

		return result.error === null;
	}
}

interface FieldMeta {
	handle: string
	type: string
	isRelation: boolean
	isLocalized: boolean
	isList: boolean
}

function gatherObjectFields(ast: DocumentNode, node: ObjectTypeDefinitionNode): FieldMeta[] {
	return (node.fields || []).reduce((fields, field) => {
		if (isComputedField(field) === false) {
			const type = getNamedTypeNode(field.type);
			const refType = getDefNodeByNamedType(ast, type);
			fields.push({
				type,
				handle: field.name.value,
				isRelation: refType !== undefined && isCollection(refType),
				isLocalized: isLocalizedField(field),
				isList: isListType(field.type)
			});
		}
		return fields;
	}, [] as FieldMeta[])
}

export class Structure<I, O extends CollectionType> extends Collection<I, O> {
	
	public static createTypeExtension(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): string {
		if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
			return extendObjectType(node);
		}
		return (node.types || []).reduce((extensions, type) => {
			const node = getDefNodeByNamedType(ast, type.name.value);
			if (node) {
				extensions.push(extendObjectType(node as ObjectTypeDefinitionNode));
			}
			return extensions;
		}, [] as string[]).join(`\n`);

		function extendObjectType(node: ObjectTypeDefinitionNode) {
			return `extend type ${node.name.value}
			@index(handle: "${node.name.value}_struct", type: "index", fields: [{ field: "parent", direction: "asc" }, { field: "order", direction: "asc" }])
			{
				parent: ${node.name.value} @inlined
				left: Int @hidden
				right: Int @hidden
				order: Int @hidden
				children: [${node.name.value}!]! @computed
			}`;
		}
	}

}

export class Single<I, O extends CollectionType> extends Collection<I, O> {
	
}

export function createCollections(driver: Database, schema: DataSchema, ast: DocumentNode, locales: Locales): Collection<any, any>[] {
	const collections: Collection<any, any>[] = [];

	for (const collection of schema.collections) {
		const node = getDefNodeByNamedType(ast, collection.handle) as ObjectTypeDefinitionNode | UnionTypeDefinitionNode;
		const directive = (node.directives || []).find(directive => directive.name.value === 'collection')!;
		const type = (directive.arguments || []).reduce((type, arg) => {
			if (arg.name.value === 'type') {
				return getValue(arg.value);
			}
			return type;
		}, 'collection');

		if (type === 'collection') {
			collections.push(new Collection(driver, locales, ast, node));
		}
		else if (type === 'structure') {
			collections.push(new Structure(driver, locales, ast, node));
		}
		else if (type === 'single') {
			collections.push(new Single(driver, locales, ast, node));
		}
		else {
			throw new SyntaxError(`Collection ${collection.handle} is of unknown type ${type}.`);
		}
	}

	return collections;
}

/**
 * Create type extension for each collections
 */
export function createTypeExtensionsFromDefinitions(ast: DocumentNode, locales: Locales): string {
	return ast.definitions.reduce((extensions, node) => {
		if ((node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.UNION_TYPE_DEFINITION) && isCollection(node)) {
			const collection = (node.directives || []).find(directive => directive.name.value === 'collection')!;
			const type = (collection.arguments || []).reduce((type, arg) => {
				if (arg.name.value === 'type') {
					return getValue(arg.value);
				}
				return type;
			}, 'collection');

			// @ts-ignore
			const collectionClass = {
				collection: Collection,
				structure: Structure,
				single: Single
			}[type] as typeof Collection;

			const extension = collectionClass.createTypeExtension(ast, node);
			if (extension) {
				extensions.push(extension);
			}
		}
		return extensions;
	}, [] as string[]).join(`\n`);
}

/**
 * Create Joi Schema from Definitions
 */
export function createValidationSchemaFromDefinition(ast: DocumentNode, node: DefinitionNode, locales: Locales): Joi.Schema {
	return transformDocumentNodeToSchema(node);

	function transformDocumentNodeToSchema(node: ObjectTypeDefinitionNode): Joi.ObjectSchema
	function transformDocumentNodeToSchema(node: UnionTypeDefinitionNode): Joi.ArraySchema
	function transformDocumentNodeToSchema(node: DefinitionNode): Joi.Schema
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
			// return [Joi.string(), Joi.number()];
			return Joi.string();
		}
		return Joi.any();
	}

	function transformFieldTypeNodeToSchema(node: FieldDefinitionNode): Joi.Schema | undefined {
		const directives = node.directives || [];
		const computed = directives.find(directive => directive.name.value === 'computed') !== undefined;
		if (computed === true) {
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
			return Joi.array().items(transformTypeNodeToSchema(node.type));
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

/**
 * Build input definitions for each collections
 */
export function createInputTypeFromDefinitions(ast: DocumentNode, locales: Locales): DocumentNode {
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
							if (localizedTypes.includes(typeName) === false) {
								localizedTypes.push(typeName);
							}
						}
						fields.push({
							kind: 'InputValueDefinition',
							name: field.name,
							type: field.type,
							directives: field.directives
						});
					}
					return fields
				}, [] as InputValueDefinitionNode[])
			}
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
			}
			inputTypes.set(node.name.value, inputType);
		}
	});

	const localCodes = Object.keys(locales);

	// Convert localized types
	localizedTypes.forEach(typeName => {
		const localizedName = `L${typeName}Input`;
		inputTypes.set(`L${typeName}`, {
			kind: 'InputObjectTypeDefinition',
			name: { kind: 'Name', value: localizedName },
			fields: localCodes.reduce((fields, code) => {
				fields.push({
					kind: 'InputValueDefinition',
					name: { kind: 'Name', value: code },
					type: { kind: 'NonNullType', type: { kind: 'NamedType', name: { kind: 'Name', value: typeName } } }
				});
				return fields;
			}, [] as InputValueDefinitionNode[])
		})
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

export function createTypeExtensionsFromDatabaseDriver(driver: Database, locales: Locales): string {
	if (driver.features.join === true) {
		return `
			type Relation
			@collection
			@index(handle: "Relation_collection", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "collection", direction: "asc" }])
			@index(handle: "Relation_field", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "collection", direction: "asc" }, { field: "field", direction: "asc" }])
			@index(handle: "Relation_source", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "source", direction: "asc" }, { field: "seq", direction: "asc" }])
			@index(handle: "Relation_target", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "target", direction: "asc" }])
			{
				id: ID!
				collection: String!
				field: String!
				source: ID!
				target: ID!
				seq: String!
			}
		`;
	}
	return '';
}