"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Query_1 = require("./Query");
const immutable_1 = require("immutable");
const util_1 = require("util");
function simplifyBinaryTree(node) {
    if (node.isLeaf()) {
        return node;
    }
    let simplified = new Query_1.Binary(node.operator);
    node.operands.forEach(operand => {
        if (operand instanceof Query_1.Comparison) {
            simplified = simplified.add(operand);
        }
        else if (operand instanceof Query_1.Binary && operand.operator === node.operator) {
            operand = simplifyBinaryTree(operand);
            if (operand.operands) {
                operand.operands.forEach(operand => {
                    simplified = simplified.add(operand);
                });
            }
        }
        else if (operand instanceof Query_1.Binary) {
            simplified = simplified.add(simplifyBinaryTree(operand));
        }
    });
    return simplified;
}
exports.simplifyBinaryTree = simplifyBinaryTree;
class QueryTooComplexeError extends Error {
}
exports.QueryTooComplexeError = QueryTooComplexeError;
function decomposeBinaryTree(tree) {
    const decomposed = [];
    const trees = [simplifyBinaryTree(tree)];
    while (trees.length > 0) {
        const root = trees.shift();
        if (root.isLeaf()) {
            if (root.operator === 'and') {
                decomposed.push(root);
            }
            else if (root.operator === 'or') {
                if (root.operands) {
                    decomposed.push(...root.operands.toArray());
                }
            }
            else if (root.operator === 'xor') {
                throw new QueryTooComplexeError(`Can not decompose XOR binary operation.`);
            }
        }
        else {
            const walk = [root];
            while (walk.length > 0) {
                const node = walk.shift();
                // Split on OR node and break
                if (node.operator === 'or') {
                    if (node.operands) {
                        trees.push(...node.operands.map(op => {
                            return simplifyBinaryTree(root.replace(node, op instanceof Query_1.Comparison ? new Query_1.Binary('and', immutable_1.List([op])) : op, true));
                        }).toArray());
                    }
                    break;
                }
                else if (root.operator === 'xor') {
                    throw new QueryTooComplexeError(`Can not decompose XOR binary operation.`);
                }
                // Continue walk with nested bitwise node
                else if (node.operands) {
                    walk.push(...node.operands.filter((op) => op instanceof Query_1.Binary).toArray());
                }
            }
        }
    }
    return decomposed;
}
exports.decomposeBinaryTree = decomposeBinaryTree;
function replaceField(source, replace, matches = []) {
    const needles = Array.from(replace.keys());
    if (typeof source === 'string') {
        for (let i = 0, l = needles.length; i < l; ++i) {
            const needle = needles[i];
            if (needle.name === source) {
                if (matches.indexOf(needle) === -1) {
                    matches.push(needle);
                }
                return replace.get(needle).name;
            }
        }
        return source;
    }
    else if (source instanceof Query_1.Field) {
        for (let i = 0, l = needles.length; i < l; ++i) {
            const needle = needles[i];
            if (needle.equal(source)) {
                if (matches.indexOf(needle) === -1) {
                    matches.push(needle);
                }
                return replace.get(needle);
            }
        }
        return source;
    }
    else if (source instanceof Query_1.FieldDirection) {
        for (let i = 0, l = needles.length; i < l; ++i) {
            const needle = needles[i];
            if (needle.equal(source.field)) {
                if (matches.indexOf(needle) === -1) {
                    matches.push(needle);
                }
                return source.rename(replace.get(needle));
            }
        }
        return source;
    }
    else if (source instanceof Query_1.FieldAs) {
        for (let i = 0, l = needles.length; i < l; ++i) {
            const needle = needles[i];
            if (source.field instanceof Query_1.Field) {
                if (needle.equal(source.field)) {
                    if (matches.indexOf(needle) === -1) {
                        matches.push(needle);
                    }
                    return source.set(replace.get(needle), source.alias);
                }
            }
            else if (source.field instanceof Query_1.Function) {
                const replaced = replaceField(source.field, replace, matches);
                if (source.field !== replaced) {
                    return source.set(replaced, source.alias);
                }
            }
        }
        return source;
    }
    else if (source instanceof Query_1.Function) {
        return source.replaceArgument(arg => {
            if (arg instanceof Query_1.Field || arg instanceof Query_1.Function) {
                return replaceField(arg, replace, matches);
            }
            return arg;
        });
    }
    else if (source instanceof Query_1.Binary) {
        return source.visit(op => {
            return replaceField(op, replace, matches);
        });
    }
    else if (source instanceof Query_1.Comparison) {
        const constructor = source.constructor;
        const args = source.args
            ? source.args.withMutations(args => {
                args.forEach((arg, idx = 0) => {
                    if (arg instanceof Query_1.Field || arg instanceof Query_1.Function) {
                        args.set(idx, replaceField(arg, replace, matches));
                    }
                });
            }).toList()
            : undefined;
        const field = replaceField(source.field, replace, matches);
        if (field !== source.field || args !== source.args) {
            return new constructor(field, args);
        }
        return source;
    }
    else if (util_1.isArray(source)) {
        return source.map(source => replaceField(source, replace, matches));
    }
    else if (source && 'withMutations' in source) {
        return source.withMutations((source) => {
            source.forEach((field, idx = 0) => {
                if (field instanceof Query_1.Field || field instanceof Query_1.FieldDirection || field instanceof Query_1.Function) {
                    const replaced = replaceField(field, replace, matches);
                    if (replaced !== field) {
                        source.set(idx, replaced);
                    }
                }
                else if (field) {
                    const { on, query } = field;
                    const fields = query.fields ? replaceField(query.fields, replace, matches) : undefined;
                    const joins = query.joins ? replaceField(query.joins, replace, matches) : undefined;
                    const conditions = query.conditions ? replaceField(query.conditions, replace, matches) : undefined;
                    const sorts = query.sorts ? replaceField(query.sorts, replace, matches) : undefined;
                    const queryRenamed = fields !== query.fields || joins !== query.joins || conditions !== query.conditions || sorts !== query.sorts
                        ? new Query_1.QuerySelect(fields, query.collection, joins, conditions, sorts, query.limit, query.offset)
                        : query;
                    const onRenamed = on instanceof Query_1.Binary ? replaceField(on, replace, matches) : replaceField(on, replace, matches);
                    if (queryRenamed !== query || onRenamed !== on) {
                        source.set(idx, { alias: field.alias, on: onRenamed, query: queryRenamed });
                    }
                }
            });
        });
    }
}
exports.replaceField = replaceField;
//# sourceMappingURL=Utils.js.map