"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const db_1 = require("@konstellio/db");
const ast_1 = require("./utilities/ast");
const Joi = require("joi");
const Dataloader = require("dataloader");
class Collection {
    constructor(driver, locales, ast, node) {
        this.driver = driver;
        this.locales = locales;
        this.name = node.name.value;
        this.collection = db_1.q.collection(this.name);
        this.defaultLocale = Object.keys(locales).shift();
        this.validation = createValidationSchemaFromDefinition(ast, node, locales);
        this.fields = node.kind === 'ObjectTypeDefinition'
            ? gatherObjectFields(ast, node)
            : (node.types || []).reduce((fields, type) => {
                const node = ast_1.getDefNodeByNamedType(ast, type.name.value);
                if (node && node.kind === 'ObjectTypeDefinition') {
                    fields.push(...gatherObjectFields(ast, node));
                }
                return fields;
            }, []);
        this.fieldMap = new Map(Object.keys(locales).map(code => [
            code,
            new Map(this.fields.reduce((fields, field) => {
                if (field.isRelation && driver.features.join) {
                    fields.push([
                        db_1.q.field(field.handle),
                        db_1.q.field('target', `ref__${field.handle}${field.isLocalized ? `__${code}` : ''}`)
                    ]);
                }
                else {
                    fields.push([
                        db_1.q.field(field.handle),
                        db_1.q.field(field.isLocalized ? `${field.handle}__${code}` : field.handle)
                    ]);
                }
                return fields;
            }, []))
        ]));
        let batchedFields = [];
        this.loader = new Dataloader((keys) => __awaiter(this, void 0, void 0, function* () {
            const ids = keys.map(key => key.id);
            const uids = ids.filter((id, pos, ids) => ids.indexOf(id) === pos);
            const fields = batchedFields.length > 0 ? batchedFields : undefined;
            batchedFields = [];
            const results = yield this.find({
                fields: fields,
                condition: db_1.q.in('id', uids)
            });
            return ids.map(id => {
                const res = results.filter(result => result.id === id);
                return res.length === 1 ? res[0] : undefined;
            });
        }), {
            cache: false,
            cacheKeyFn(key) {
                const { id, fields } = key;
                // TODO: use locale...
                if (fields) {
                    batchedFields.push(...fields);
                }
                return id;
            }
        });
    }
    // @ts-ignore
    static createTypeExtension(ast, node) {
        return '';
    }
    // @ts-ignore
    static createResolvers(ast, node) {
        return {};
    }
    findById(id, { locale, fields }) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.loader.load({ id, locale, fields });
                if (result) {
                    return result;
                }
            }
            catch (err) { }
            throw new Error(`Could not find ID ${id} in ${this.name}.`);
        });
    }
    findByIds(ids, { locale, fields }) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const results = yield this.loader.loadMany(ids.map(id => ({ id, locale, fields })));
                const realResults = results.filter((result) => result !== undefined);
                if (realResults.length === ids.length) {
                    return realResults;
                }
            }
            catch (err) { }
            throw new Error(`Could not find IDs ${ids.join(', ')} in ${this.name}.`);
        });
    }
    findOne(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.find(Object.assign({}, options, { limit: 1 }));
            if (results.length === 0) {
                throw new Error(`Could not find anything matching query in ${this.name}.`);
            }
            return results[0];
        });
    }
    find(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.aggregate(options);
        });
    }
    aggregate(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const fieldsUsed = [];
            const locale = options.locale || this.defaultLocale;
            const fieldMap = this.fieldMap.get(locale);
            const fields = options.fields || Array.from(fieldMap.keys());
            const select = db_1.replaceField(fields, fieldMap, fieldsUsed);
            let query = db_1.q.aggregate(...select).from(this.collection).range({ limit: options.limit, offset: options.offset });
            if (options.condition) {
                query = query.where(db_1.replaceField((options.condition instanceof db_1.Comparison ? db_1.q.and(options.condition) : options.condition), fieldMap, fieldsUsed));
            }
            if (options.group) {
                query = query.group(...db_1.replaceField(options.group, fieldMap, fieldsUsed));
            }
            if (options.sort) {
                query = query.sort(...db_1.replaceField(options.sort, fieldMap, fieldsUsed));
            }
            if (this.driver.features.join) {
                const relations = fieldsUsed
                    .map(field => [field, this.fields.find(f => f.handle === field.name)])
                    .filter(([, meta]) => meta !== undefined && meta.isRelation);
                relations.forEach(([fieldUsed, meta]) => {
                    // const localizedField = replaceField(fieldUsed, fieldMap) as Field;
                    const field = fieldUsed.name;
                    const alias = `ref__${field}`;
                    const relationCollection = db_1.q.collection(meta.type);
                    query = query.join(alias, db_1.q.select('collection', 'field', 'source', 'target', 'seq').from(relationCollection).where(db_1.q.and(db_1.q.eq('collection', meta.type), db_1.q.eq('field', field))), db_1.q.eq(db_1.q.field('source', alias), db_1.q.field('id')));
                });
            }
            const result = yield this.driver.execute(query);
            // TODO: remap localized field to their original
            // TODO: fetch relation
            debugger;
            return [];
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return '';
        });
    }
    replace(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return false;
        });
    }
    delete(ids) {
        return __awaiter(this, void 0, void 0, function* () {
            return false;
        });
    }
    validate(data, errors = []) {
        if (typeof data !== 'object') {
            errors.push(new Error(`Expected data to be an object.`));
            return false;
        }
        const result = Joi.validate(data, this.validation);
        return result.error === null;
    }
}
exports.Collection = Collection;
function gatherObjectFields(ast, node) {
    return (node.fields || []).reduce((fields, field) => {
        if (ast_1.isComputedField(field) === false) {
            const type = ast_1.getNamedTypeNode(field.type);
            const refType = ast_1.getDefNodeByNamedType(ast, type);
            fields.push({
                handle: field.name.value,
                type: type,
                isRelation: refType !== undefined && ast_1.isCollection(refType),
                isLocalized: ast_1.isLocalizedField(field),
                isList: ast_1.isListType(field.type)
            });
        }
        return fields;
    }, []);
}
class Structure extends Collection {
    static createTypeExtension(ast, node) {
        if (node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION) {
            return extendObjectType(node);
        }
        return (node.types || []).reduce((extensions, type) => {
            const node = ast_1.getDefNodeByNamedType(ast, type.name.value);
            if (node) {
                extensions.push(extendObjectType(node));
            }
            return extensions;
        }, []).join(`\n`);
        function extendObjectType(node) {
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
exports.Structure = Structure;
class Single extends Collection {
}
exports.Single = Single;
function createCollections(driver, schema, ast, locales) {
    const collections = [];
    for (const collection of schema.collections) {
        const node = ast_1.getDefNodeByNamedType(ast, collection.handle);
        const directive = (node.directives || []).find(directive => directive.name.value === 'collection');
        const type = (directive.arguments || []).reduce((type, arg) => {
            if (arg.name.value === 'type') {
                return ast_1.getValue(arg.value);
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
exports.createCollections = createCollections;
/**
 * Create type extension for each collections
 */
function createTypeExtensionsFromDefinitions(ast, locales) {
    return ast.definitions.reduce((extensions, node) => {
        if ((node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION || node.kind === graphql_1.Kind.UNION_TYPE_DEFINITION) && ast_1.isCollection(node)) {
            const collection = (node.directives || []).find(directive => directive.name.value === 'collection');
            const type = (collection.arguments || []).reduce((type, arg) => {
                if (arg.name.value === 'type') {
                    return ast_1.getValue(arg.value);
                }
                return type;
            }, 'collection');
            // @ts-ignore
            const collectionClass = {
                collection: Collection,
                structure: Structure,
                single: Single
            }[type];
            const extension = collectionClass.createTypeExtension(ast, node);
            if (extension) {
                extensions.push(extension);
            }
        }
        return extensions;
    }, []).join(`\n`);
}
exports.createTypeExtensionsFromDefinitions = createTypeExtensionsFromDefinitions;
/**
 * Create Joi Schema from Definitions
 */
function createValidationSchemaFromDefinition(ast, node, locales) {
    return transformDocumentNodeToSchema(node);
    function transformDocumentNodeToSchema(node) {
        if (node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION) {
            return Joi.object().keys((node.fields || []).reduce((keys, field) => {
                if (field.name.value !== 'id') {
                    const schema = transformFieldTypeNodeToSchema(field);
                    if (schema) {
                        keys[field.name.value] = schema;
                    }
                }
                return keys;
            }, {}));
        }
        else if (node.kind === graphql_1.Kind.UNION_TYPE_DEFINITION) {
            return Joi.array().items(...(node.types || []).map(type => {
                const typeNode = ast_1.getDefNodeByNamedType(ast, type.name.value);
                return typeNode
                    ? transformDocumentNodeToSchema(typeNode).keys({
                        _typename: Joi.string().valid(typeNode.name.value).required()
                    })
                    : Joi.any();
            }));
        }
        else if (node.kind === graphql_1.Kind.ENUM_TYPE_DEFINITION) {
            // return [Joi.string(), Joi.number()];
            return Joi.string();
        }
        return Joi.any();
    }
    function transformFieldTypeNodeToSchema(node) {
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
            }, {}));
        }
        return typeSchema;
    }
    function transformTypeNodeToSchema(node) {
        if (node.kind === graphql_1.Kind.NON_NULL_TYPE) {
            return transformTypeNodeToSchema(node.type).required();
        }
        else if (node.kind === graphql_1.Kind.LIST_TYPE) {
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
                const refNode = ast_1.getDefNodeByNamedType(ast, node.name.value);
                if (refNode === undefined) {
                    return Joi.any();
                }
                else if ((refNode.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION || refNode.kind === graphql_1.Kind.UNION_TYPE_DEFINITION) && ast_1.isCollection(refNode)) {
                    return Joi.string(); // Same as ID
                }
                return transformDocumentNodeToSchema(refNode);
        }
    }
}
exports.createValidationSchemaFromDefinition = createValidationSchemaFromDefinition;
/**
 * Build input definitions for each collections
 */
function createInputTypeFromDefinitions(ast, locales) {
    const inputAST = {
        kind: 'Document',
        definitions: []
    };
    const inputTypes = new Map();
    const collectionTypes = [];
    const localizedTypes = [];
    // Convert Object type definition to Input type definition with their original fields type
    ast.definitions.forEach(node => {
        if (node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION) {
            if (ast_1.isCollection(node)) {
                collectionTypes.push(node.name.value);
            }
            const inputType = {
                kind: 'InputObjectTypeDefinition',
                name: { kind: 'Name', value: `${node.name.value}Input` },
                directives: node.directives || [],
                fields: (node.fields || []).reduce((fields, field) => {
                    if (field.name.value !== 'id' &&
                        (field.directives === undefined ||
                            field.directives.find(directive => directive.name.value === 'computed') === undefined)) {
                        if (field.directives && field.directives.find(directive => directive.name.value === 'localized')) {
                            const typeName = ast_1.getNamedTypeNode(field.type);
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
                    return fields;
                }, [])
            };
            inputTypes.set(node.name.value, inputType);
        }
    });
    // Convert Union type definition to Input type definition
    ast.definitions.forEach(node => {
        if (node.kind === graphql_1.Kind.UNION_TYPE_DEFINITION) {
            const inputType = {
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
                ])
            };
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
            }, [])
        });
    });
    // Convert field type to their corresponding input type or ID if they reference a collection type
    inputTypes.forEach(node => {
        // @ts-ignore
        node.directives = undefined;
        // @ts-ignore
        node.fields.forEach(field => {
            // @ts-ignore
            field.type = transformType(field.type, field.directives && field.directives.find(directive => directive.name.value === 'localized') !== undefined);
            // @ts-ignore
            field.directives = undefined;
        });
        // @ts-ignore
        inputAST.definitions.push(node);
    });
    return inputAST;
    function stripNonNullType(type) {
        if (type.kind === 'ListType') {
            return { kind: 'ListType', type: stripNonNullType(type.type) };
        }
        else if (type.kind === 'NonNullType') {
            return type.type;
        }
        return type;
    }
    function transformType(type, localized = false, union = false) {
        if (type.kind === 'ListType') {
            return { kind: 'ListType', type: transformType(type.type, localized, union) };
        }
        else if (type.kind === 'NonNullType') {
            return { kind: 'NonNullType', type: transformType(type.type, localized, union) };
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
exports.createInputTypeFromDefinitions = createInputTypeFromDefinitions;
function createTypeExtensionsFromDatabaseDriver(driver, locales) {
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
exports.createTypeExtensionsFromDatabaseDriver = createTypeExtensionsFromDatabaseDriver;
//# sourceMappingURL=collection.js.map