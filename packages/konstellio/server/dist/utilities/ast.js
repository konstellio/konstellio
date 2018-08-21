"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
/**
 * Merge multiple DocumentNode into one, collapsing type extension into their type definition
 */
function mergeAST(documents) {
    const concat = graphql_1.concatAST(documents);
    const nodeDefMap = new Map();
    const nodeExtMap = new Map();
    concat.definitions.forEach(node => {
        const name = node.name.value;
        if (isTypeExtensionNode(node)) {
            if (nodeExtMap.has(name) === false) {
                nodeExtMap.set(name, []);
            }
            nodeExtMap.get(name).push(node);
        }
        else {
            nodeDefMap.set(name, node);
        }
    });
    return {
        kind: concat.kind,
        definitions: concat.definitions.reduce((definitions, node) => {
            if (isTypeDefinitionNode(node)) {
                const extensions = nodeExtMap.get(node.name.value);
                if (extensions) {
                    if (node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION) {
                        definitions.push(Object.assign({}, node, { interfaces: (node.interfaces || []).concat(extensions.reduce((interfaces, ext) => { interfaces.push(...ext.interfaces); return interfaces; }, [])), directives: (node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, [])), fields: (node.fields || []).concat(extensions.reduce((fields, ext) => { fields.push(...ext.fields); return fields; }, [])) }));
                    }
                    else if (node.kind === graphql_1.Kind.INPUT_OBJECT_TYPE_DEFINITION) {
                        definitions.push(Object.assign({}, node, { directives: (node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, [])), fields: (node.fields || []).concat(extensions.reduce((fields, ext) => { fields.push(...ext.fields); return fields; }, [])) }));
                    }
                    else if (node.kind === graphql_1.Kind.ENUM_TYPE_DEFINITION) {
                        definitions.push(Object.assign({}, node, { directives: (node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, [])), values: (node.values || []).concat(extensions.reduce((values, ext) => { values.push(...ext.values); return values; }, [])) }));
                    }
                    else if (node.kind === graphql_1.Kind.UNION_TYPE_DEFINITION) {
                        definitions.push(Object.assign({}, node, { directives: (node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, [])), types: (node.types || []).concat(extensions.reduce((types, ext) => { types.push(...ext.types); return types; }, [])) }));
                    }
                    else if (node.kind === graphql_1.Kind.SCALAR_TYPE_DEFINITION) {
                        // FIXME: Extend scalar type
                        // definitions.push({
                        // 	...node,
                        // 	directives: (node.directives || []).concat(extensions.reduce((directives, ext) => { directives.push(...ext.directives); return directives; }, [])),
                        // 	types: (node.types || []).concat(extensions.reduce((types, ext) => { types.push(...ext.types); return types; }, [])),
                        // });
                    }
                }
                else {
                    definitions.push(node);
                }
            }
            else if (isTypeExtensionNode(node) && nodeDefMap.has(node.name.value) === false) {
                definitions.push(node);
            }
            return definitions;
        }, [])
    };
}
exports.mergeAST = mergeAST;
function getDefNodeByNamedType(ast, name) {
    return ast.definitions.find((def) => (
    // isTypeExtensionNode(def) === false &&
    def.name && def.name.value === name));
}
exports.getDefNodeByNamedType = getDefNodeByNamedType;
function isTypeDefinitionNode(node) {
    return node && node.kind && (node.kind === graphql_1.Kind.SCALAR_TYPE_DEFINITION ||
        node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION ||
        node.kind === graphql_1.Kind.INTERFACE_TYPE_DEFINITION ||
        node.kind === graphql_1.Kind.UNION_TYPE_DEFINITION ||
        node.kind === graphql_1.Kind.ENUM_TYPE_DEFINITION ||
        node.kind === graphql_1.Kind.INPUT_OBJECT_TYPE_DEFINITION);
}
exports.isTypeDefinitionNode = isTypeDefinitionNode;
// TODO: Add types when @types/graphql will get updated...
// function isTypeExtensionNode(node: any): node is TypeExtensionNode {
function isTypeExtensionNode(node) {
    return node && node.kind && (node.kind === 'TypeExtensionDefinition' || // remove this ?
        node.kind === 'ScalarTypeExtension' ||
        node.kind === 'ObjectTypeExtension' ||
        node.kind === 'InterfaceTypeExtension' ||
        node.kind === 'UnionTypeExtension' ||
        node.kind === 'EnumTypeExtension' ||
        node.kind === 'InputObjectTypeExtension');
}
exports.isTypeExtensionNode = isTypeExtensionNode;
function buildTypeName(type) {
    if (type.kind === graphql_1.Kind.LIST_TYPE) {
        return `List${buildTypeName(type.type)}`;
    }
    else if (type.kind === graphql_1.Kind.NON_NULL_TYPE) {
        return `Req${buildTypeName(type.type)}`;
    }
    else {
        return type.name.value;
    }
}
exports.buildTypeName = buildTypeName;
function isCollection(node) {
    return (node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION || node.kind === graphql_1.Kind.UNION_TYPE_DEFINITION) &&
        node.directives !== undefined &&
        node.directives.find(d => d.name.value === 'collection') !== undefined;
}
exports.isCollection = isCollection;
function isComputedField(node) {
    return node.directives !== undefined && ((node.arguments || []).length > 0 || node.directives.find(d => d.name.value === 'computed') !== undefined);
}
exports.isComputedField = isComputedField;
function isLocalizedField(node) {
    return node.directives !== undefined && node.directives.find(d => d.name.value === 'localized') !== undefined;
}
exports.isLocalizedField = isLocalizedField;
function getNamedTypeNode(type) {
    if (type.kind === graphql_1.Kind.NAMED_TYPE) {
        return type.name.value;
    }
    return getNamedTypeNode(type.type);
}
exports.getNamedTypeNode = getNamedTypeNode;
function isNonNullType(type) {
    if (type.kind === graphql_1.Kind.NON_NULL_TYPE) {
        return true;
    }
    else if (type.kind === graphql_1.Kind.LIST_TYPE) {
        return isNonNullType(type.type);
    }
    return false;
}
exports.isNonNullType = isNonNullType;
function isListType(type) {
    if (type.kind === graphql_1.Kind.LIST_TYPE) {
        return true;
    }
    else if (type.kind === graphql_1.Kind.NON_NULL_TYPE) {
        return isListType(type.type);
    }
    return false;
}
exports.isListType = isListType;
function getValue(node) {
    if (node.kind === graphql_1.Kind.VARIABLE) {
        return null;
    }
    else if (node.kind === graphql_1.Kind.LIST) {
        return node.values.map(getValue);
    }
    else if (node.kind === graphql_1.Kind.OBJECT) {
        return node.fields.reduce((obj, field) => {
            obj[field.name.value] = getValue(field.value);
            return obj;
        }, {});
    }
    else if (node.kind === graphql_1.Kind.NULL) {
        return null;
    }
    else {
        return node.value;
    }
}
exports.getValue = getValue;
function getArgumentsValues(nodes) {
    if (nodes === undefined)
        return {};
    return nodes.reduce((args, arg) => {
        args[arg.name.value] = getValue(arg.value);
        return args;
    }, {});
}
exports.getArgumentsValues = getArgumentsValues;
//# sourceMappingURL=ast.js.map