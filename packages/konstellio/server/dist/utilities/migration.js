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
const assert = require("assert");
const util_1 = require("util");
const ast_1 = require("./ast");
const cli_1 = require("./cli");
/**
 * Create Schema from DocumentNode
 */
function createSchemaFromDefinitions(ast, locales) {
    return __awaiter(this, void 0, void 0, function* () {
        return {
            collections: ast.definitions.reduce((collections, node) => {
                if (ast_1.isCollection(node)) {
                    const collection = transformDocumentNodeToCollection(node);
                    if (collection) {
                        collections.push(collection);
                    }
                }
                return collections;
            }, [])
        };
        function getDefNodeByNamedType(name) {
            return ast.definitions.find((def) => def.name && def.name.value === name);
        }
        function transformDocumentNodeToCollection(node) {
            if (node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION) {
                return {
                    handle: node.name.value,
                    indexes: transformDirectivesToIndexes(node.directives, node.fields),
                    fields: transformFieldsToFields(node.fields)
                };
            }
            else if (node.kind === graphql_1.Kind.UNION_TYPE_DEFINITION) {
                const fields = node.types.reduce((fields, type) => {
                    const typeNode = getDefNodeByNamedType(type.name.value);
                    fields.push(...typeNode.fields);
                    return fields;
                }, []);
                return {
                    handle: node.name.value,
                    indexes: transformDirectivesToIndexes(node.directives, fields),
                    fields: [{ handle: '_typename', type: 'Text' }].concat(transformFieldsToFields(fields))
                };
            }
        }
        function transformDirectivesToIndexes(directives, fields) {
            return (directives || []).reduce((indexes, directive) => {
                if (directive.name.value === 'index') {
                    const args = ast_1.getArgumentsValues(directive.arguments);
                    assert(typeof args.handle === 'string', 'Expected field @index.handle of type string.');
                    assert(typeof args.type === 'string', 'Expected field @index.type of type string.');
                    assert(['primary', 'unique', 'index'].indexOf(args.type) > -1, 'Expected field @index.type to be either "primary", "unique" or "index".');
                    assert(args.fields && util_1.isArray(args.fields), 'Expected field @index.fields of type array.');
                    args.fields.forEach(field => {
                        assert(typeof field.field === 'string', 'Expected field @index.fields[].field of type string');
                        assert(['asc', 'desc'].indexOf(field.direction) > -1, 'Expected field @index.fields[].direction to be either "asc" or "desc".');
                    });
                    const localized = args.fields.reduce((localize, field) => {
                        const fieldNode = fields.find(f => f.name.value === field.field);
                        if (fieldNode) {
                            const directives = fieldNode.directives || [];
                            const localized = directives.find(directive => directive.name.value === 'localized') !== undefined;
                            if (localized) {
                                localize.push(field.field);
                            }
                        }
                        return localize;
                    }, []);
                    if (localized.length > 0) {
                        Object.keys(locales).forEach(code => {
                            indexes.push({
                                handle: `${args.handle}__${code}`,
                                type: args.type,
                                fields: args.fields.map(field => ({
                                    field: localized.includes(field.field) ? `${field.field}__${code}` : field.field,
                                    direction: field.direction
                                }))
                            });
                        });
                    }
                    else {
                        indexes.push({
                            handle: args.handle,
                            type: args.type,
                            fields: args.fields
                        });
                    }
                }
                return indexes;
            }, []);
        }
        function transformFieldsToFields(fields) {
            return fields.reduce((fields, field) => {
                const directives = field.directives || [];
                const computed = directives.find(directive => directive.name.value === 'computed') !== undefined;
                const inlined = directives.find(directive => directive.name.value === 'inlined') !== undefined;
                const multiple = ast_1.isListType(field.type);
                const localized = directives.find(directive => directive.name.value === 'localized') !== undefined;
                // const type = inlined
                // 	? [ColumnType.Blob, -1, true] as [ColumnType, number, boolean]
                // 	: transformTypeNodeToType(field.type);
                let type = transformTypeNodeToType(field.type);
                if (inlined) {
                    type = [
                        type && type[2] === false ? type[0] : db_1.ColumnType.Text,
                        type ? type[1] : -1,
                        true
                    ];
                }
                if (computed === false &&
                    type &&
                    (multiple === false || type[2] === true)) {
                    if (localized) {
                        Object.keys(locales).forEach(code => {
                            fields.push({
                                handle: `${field.name.value}__${code}`,
                                type: type[0],
                                size: type[1]
                            });
                        });
                    }
                    else {
                        fields.push({
                            handle: field.name.value,
                            type: type[0],
                            size: type[1]
                        });
                    }
                }
                return fields;
            }, []);
        }
        function transformTypeNodeToType(node) {
            if (node.kind === graphql_1.Kind.NON_NULL_TYPE || node.kind === graphql_1.Kind.LIST_TYPE) {
                return transformTypeNodeToType(node.type);
            }
            switch (node.name.value) {
                case 'ID':
                    return [db_1.ColumnType.Text, -1, false];
                case 'String':
                    return [db_1.ColumnType.Text, -1, false];
                case 'Int':
                    return [db_1.ColumnType.Int, -1, false];
                case 'Float':
                    return [db_1.ColumnType.Float, -1, false];
                case 'Boolean':
                    return [db_1.ColumnType.Boolean, -1, false];
                case 'Date':
                    return [db_1.ColumnType.Date, -1, false];
                case 'DateTime':
                    return [db_1.ColumnType.DateTime, -1, false];
                default:
                    const refNode = getDefNodeByNamedType(node.name.value);
                    if (refNode) {
                        if (refNode.kind === graphql_1.Kind.ENUM_TYPE_DEFINITION) {
                            return [db_1.ColumnType.Text, -1, false];
                        }
                        else if (ast_1.isCollection(refNode) === false) {
                            return [db_1.ColumnType.Blob, -1, true];
                        }
                    }
            }
        }
    });
}
exports.createSchemaFromDefinitions = createSchemaFromDefinitions;
/**
 * Create Schema from Database
 */
function createSchemaFromDatabase(database, locales) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield database.execute(db_1.q.showCollection());
        const collections = [];
        for (let collection of result.collections) {
            const desc = yield database.execute(db_1.q.describeCollection(collection));
            collections.push({
                handle: desc.collection.name,
                indexes: desc.indexes.map(index => ({
                    handle: index.name,
                    type: index.type,
                    fields: index.columns.map(col => ({
                        field: col.field.name,
                        direction: col.direction
                    })).toArray()
                })),
                fields: desc.columns.map(col => ({
                    handle: col.name,
                    type: col.type,
                    size: col.size
                }))
            });
        }
        return {
            collections
        };
    });
}
exports.createSchemaFromDatabase = createSchemaFromDatabase;
/**
 * Compute schema differences
 */
function computeSchemaDiff(source, target, compareTypes) {
    const diffs = [];
    for (let targetCollection of target.collections) {
        const sourceCollection = source.collections.find(collection => collection.handle === targetCollection.handle);
        if (sourceCollection === undefined) {
            diffs.push({ action: 'add_collection', collection: targetCollection, sourceSchema: source });
        }
        else {
            for (let targetIndex of targetCollection.indexes) {
                const sourceIndex = sourceCollection.indexes.find(index => index.handle === targetIndex.handle);
                if (sourceIndex === undefined) {
                    diffs.push({ action: 'add_index', collection: targetCollection, index: targetIndex });
                }
                else {
                    let alterIndex = targetIndex.type !== sourceIndex.type;
                    if (alterIndex === false) {
                        for (let targetField of targetIndex.fields) {
                            const sourceField = sourceIndex.fields.find(field => field.field === targetField.field);
                            if (sourceField === undefined || sourceField.direction !== targetField.direction) {
                                alterIndex = true;
                                break;
                            }
                        }
                    }
                    if (alterIndex) {
                        diffs.push({ action: 'alter_index', collection: targetCollection, index: targetIndex });
                    }
                }
            }
            for (let sourceIndex of sourceCollection.indexes) {
                const targetIndex = targetCollection.indexes.find(index => index.handle === sourceIndex.handle);
                if (targetIndex === undefined) {
                    diffs.push({ action: 'drop_index', collection: targetCollection, index: sourceIndex });
                }
            }
            for (let targetField of targetCollection.fields) {
                const sourceField = sourceCollection.fields.find(field => field.handle === targetField.handle);
                if (sourceField === undefined) {
                    diffs.push({ action: 'add_field', collection: targetCollection, field: targetField, sourceCollection });
                }
                else if ((compareTypes(sourceField.type, sourceField.size || -1, targetField.type, targetField.size || -1) & db_1.Compare.Castable) === 0) {
                    diffs.push({ action: 'alter_field', collection: targetCollection, field: targetField, sourceCollection });
                }
            }
            for (let sourceField of sourceCollection.fields) {
                const targetField = targetCollection.fields.find(index => index.handle === sourceField.handle);
                if (targetField === undefined) {
                    diffs.push({ action: 'drop_field', collection: targetCollection, field: sourceField });
                }
            }
        }
    }
    for (let sourceCollection of source.collections) {
        const targetCollection = target.collections.find(collection => collection.handle === sourceCollection.handle);
        if (targetCollection === undefined) {
            diffs.push({ action: 'drop_collection', collection: sourceCollection });
        }
    }
    return diffs;
}
exports.computeSchemaDiff = computeSchemaDiff;
/**
 * Prompt user for migration diffs
 */
function promptSchemaDiffs(stdin, stdout, diffs, compareTypes) {
    return __awaiter(this, void 0, void 0, function* () {
        const actions = [];
        const renamedCollection = [];
        for (let diff of diffs) {
            if (diff.action === 'add_collection') {
                const tmpSchema = { collections: [{ handle: diff.collection.handle, fields: diff.collection.fields, indexes: [] }] };
                const similarCollections = diff.sourceSchema.collections.filter(collection => computeSchemaDiff(tmpSchema, { collections: [{ handle: diff.collection.handle, fields: collection.fields, indexes: [] }] }, compareTypes).length === 0);
                if (similarCollections.length > 0) {
                    const choices = [['$empty', `Leave \`${diff.collection.handle}\` empty`]].concat(similarCollections.map(collection => ([collection.handle, `Copy content from \`${collection.handle}\``])), [['$abort', `Abort migration`]]);
                    let choice;
                    try {
                        choice = yield cli_1.promptSelection(stdin, stdout, `Schema has a new collection \`${diff.collection.handle}\`, how do we initialize it?`, new Map(choices));
                    }
                    catch (err) {
                        choice = '$abort';
                    }
                    if (choice === '$abort') {
                        throw new Error(`User aborted migration.`);
                    }
                    else if (choice === '$empty') {
                        actions.push(diff);
                    }
                    else {
                        renamedCollection.push(choice);
                        actions.push({
                            action: 'rename_collection',
                            collection: diff.collection,
                            renamedFrom: choice
                        });
                    }
                }
                else {
                    actions.push(diff);
                }
            }
            else if (diff.action === 'add_field') {
                const collection = diff.collection;
                const newField = diff.field;
                const sourceFieldsOfSameType = diff.sourceCollection.fields.filter(field => field.type === newField.type);
                if (sourceFieldsOfSameType.length > 0) {
                    const sourceFieldsOfSameTypeNoLongerUsed = sourceFieldsOfSameType.filter(field => collection.fields.find(f => f.handle === field.handle) === undefined);
                    const choices = [['$empty', `Leave \`${collection.handle}\`.\`${newField.handle}\` empty`]].concat(sourceFieldsOfSameTypeNoLongerUsed.map(field => ([field.handle, `Copy content from \`${collection.handle}\`.\`${field.handle}\``])), [['$abort', `Abort migration`]]);
                    let choice;
                    try {
                        choice = yield cli_1.promptSelection(stdin, stdout, `Schema has a new field \`${collection.handle}\`.\`${newField.handle}\`, how do we initialize it?`, new Map(choices));
                    }
                    catch (err) {
                        choice = '$abort';
                    }
                    if (choice === '$abort') {
                        throw new Error(`User aborted migration.`);
                    }
                    else if (choice === '$empty') {
                        actions.push(diff);
                    }
                    else {
                        actions.push(Object.assign({}, diff, { renamedTo: choice }));
                    }
                }
                else {
                    actions.push(diff);
                }
            }
            else if (diff.action === 'drop_field') {
                const collection = diff.collection;
                const dropField = diff.field;
                const choices = [['$drop', `Drop \`${collection.handle}\`.\`${dropField.handle}\``], ['$abort', `Abort migration`]];
                let choice;
                try {
                    choice = yield cli_1.promptSelection(stdin, stdout, `Field \`${collection.handle}\`.\`${dropField.handle}\` is no longer defined in schema, confirm deletion?`, new Map(choices));
                }
                catch (err) {
                    choice = '$abort';
                }
                if (choice === '$abort') {
                    throw new Error(`User aborted migration.`);
                }
                else {
                    actions.push(diff);
                }
            }
            else if (diff.action === 'drop_collection') {
                const collection = diff.collection;
                if (renamedCollection.includes(collection.handle) === false) {
                    const choices = [['$drop', `Drop \`${collection.handle}\``], ['$abort', `Abort migration`]];
                    let choice;
                    try {
                        choice = yield cli_1.promptSelection(stdin, stdout, `Collection \`${collection.handle}\` is no longer defined in schema, confirm deletion?`, new Map(choices));
                    }
                    catch (err) {
                        choice = '$abort';
                    }
                    if (choice === '$abort') {
                        throw new Error(`User aborted migration.`);
                    }
                    else {
                        actions.push(diff);
                    }
                }
            }
            else {
                actions.push(diff);
            }
        }
        return actions;
    });
}
exports.promptSchemaDiffs = promptSchemaDiffs;
/**
 * Execute schema diff
 */
function executeSchemaDiff(diffs, database) {
    return __awaiter(this, void 0, void 0, function* () {
        diffs = diffs.sort((a, b) => {
            if (a.action === 'drop_collection' || a.action === 'drop_field' || a.action === 'drop_index') {
                return 1;
            }
            return 0;
        });
        const dropCollections = [];
        const createCollections = [];
        const alterCollections = new Map();
        for (let diff of diffs) {
            if (diff.action === 'add_collection') {
                const columns = diff.collection.fields
                    .map(field => {
                    return db_1.q.column(field.handle, field.type, field.size);
                });
                const indexes = diff.collection.indexes
                    .map(index => {
                    const columns = index.fields.map(field => {
                        return db_1.q.sort(db_1.q.field(field.field), field.direction || 'asc');
                    });
                    return db_1.q.index(index.handle, index.type, columns);
                });
                createCollections.push(db_1.q.createCollection(diff.collection.handle).define(columns, indexes));
            }
            else if (diff.action === 'rename_collection') {
                if (alterCollections.has(diff.renamedFrom) === false) {
                    alterCollections.set(diff.renamedFrom, db_1.q.alterCollection(diff.renamedFrom));
                }
                alterCollections.set(diff.renamedFrom, alterCollections.get(diff.renamedFrom).rename(diff.collection.handle));
            }
            else if (diff.action === 'drop_collection') {
                dropCollections.push(db_1.q.dropCollection(diff.collection.handle));
            }
            else {
                if (alterCollections.has(diff.collection.handle) === false) {
                    alterCollections.set(diff.collection.handle, db_1.q.alterCollection(diff.collection.handle));
                }
                if (diff.action === 'add_field') {
                    alterCollections.set(diff.collection.handle, alterCollections.get(diff.collection.handle).addColumn(db_1.q.column(diff.field.handle, diff.field.type, diff.field.size), diff.renamedTo));
                }
                else if (diff.action === 'alter_field') {
                    alterCollections.set(diff.collection.handle, alterCollections.get(diff.collection.handle).alterColumn(diff.field.handle, db_1.q.column(diff.field.handle, diff.field.type, diff.field.size)));
                }
                else if (diff.action === 'drop_field') {
                    alterCollections.set(diff.collection.handle, alterCollections.get(diff.collection.handle).dropColumn(diff.field.handle));
                }
                else if (diff.action === 'add_index') {
                    const columns = diff.index.fields.map(field => db_1.q.sort(db_1.q.field(field.field), field.direction));
                    alterCollections.set(diff.collection.handle, alterCollections.get(diff.collection.handle).addIndex(db_1.q.index(diff.index.handle, diff.index.type, columns)));
                }
                else if (diff.action === 'alter_index') {
                    const columns = diff.index.fields.map(field => db_1.q.sort(db_1.q.field(field.field), field.direction));
                    alterCollections.set(diff.collection.handle, alterCollections.get(diff.collection.handle)
                        .dropIndex(diff.index.handle)
                        .addIndex(db_1.q.index(diff.index.handle, diff.index.type, columns)));
                }
                else if (diff.action === 'drop_index') {
                    alterCollections.set(diff.collection.handle, alterCollections.get(diff.collection.handle).dropIndex(diff.index.handle));
                }
            }
        }
        yield Promise.all([].concat(dropCollections.map(query => database.execute(query)), createCollections.map(query => database.execute(query)), Array.from(alterCollections.values()).map(query => database.execute(query))));
    });
}
exports.executeSchemaDiff = executeSchemaDiff;
//# sourceMappingURL=migration.js.map