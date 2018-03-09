import { Binary, Comparison, Field, FieldDirection, Function, Join, Query, BinaryExpression, QuerySelect } from './Query';
import { List } from 'immutable';
import { isArray } from 'util';

export function simplifyBinaryTree(node: Binary) {
	if (node.isLeaf()) {
		return node;
	}

	let simplified = new Binary(node.operator);
	node.operands.forEach(operand => {
		if (operand instanceof Comparison) {
			simplified = simplified.add(operand);
		}
		else if (operand instanceof Binary && operand.operator === node.operator) {
			operand = simplifyBinaryTree(operand);
			if (operand.operands) {
				operand.operands.forEach(operand => {
					simplified = simplified.add(operand!);
				});
			}
		}
		else if (operand instanceof Binary) {
			simplified = simplified.add(simplifyBinaryTree(operand));
		}
	});

	return simplified;
}

export class QueryTooComplexeError extends Error {}

export function decomposeBinaryTree(tree: Binary): BinaryExpression[] {

	const decomposed: BinaryExpression[] = [];
	const trees: Binary[] = [simplifyBinaryTree(tree)];

	while (trees.length > 0) {
		const root = trees.shift()!;

		if (root.isLeaf()) {
			if (root.operator === 'and') {
				decomposed.push(root);
			}
			else if (root.operator === 'or') {
				if (root.operands) {
					decomposed.push(...root.operands.toArray())
				}
			}
			else if (root.operator === 'xor') {
				throw new QueryTooComplexeError(`Can not decompose XOR binary operation.`);
			}
		}
		else {
			const walk = [root];

			while (walk.length > 0) {
				const node = walk.shift()!;

				// Split on OR node and break
				if (node.operator === 'or') {
					if (node.operands) {
						trees.push(...node.operands.map(op => {
							return simplifyBinaryTree(root.replace(node, op instanceof Comparison ? new Binary('and', List([op])) : op!, true));
						}).toArray());
					}
					break;
				}

				else if (root.operator === 'xor') {
					throw new QueryTooComplexeError(`Can not decompose XOR binary operation.`);
				}

				// Continue walk with nested bitwise node
				else if (node.operands) {
					walk.push(...<Binary[]>node.operands.filter((op): op is Binary => op instanceof Binary).toArray());
				}
			}
		}
	}

	return decomposed;
}

export function renameField(source: string, replace: Map<Field, Field>): string
export function renameField(source: Field, replace: Map<Field, Field>): Field
export function renameField(source: FieldDirection, replace: Map<Field, Field>): FieldDirection
export function renameField(source: Function, replace: Map<Field, Field>): Function
export function renameField(source: Binary, replace: Map<Field, Field>): Binary
export function renameField(source: Comparison, replace: Map<Field, Field>): Comparison
export function renameField(source: Field[], replace: Map<Field, Field>): Field[]
export function renameField(source: FieldDirection[], replace: Map<Field, Field>): FieldDirection[]
export function renameField(source: Function[], replace: Map<Field, Field>): Function[]
export function renameField(source: Join[], replace: Map<Field, Field>): Join[]
export function renameField(source: List<Field>, replace: Map<Field, Field>): List<Field>
export function renameField(source: List<FieldDirection>, replace: Map<Field, Field>): List<FieldDirection>
export function renameField(source: List<Function>, replace: Map<Field, Field>): List<Function>
export function renameField(source: List<Join>, replace: Map<Field, Field>): List<Join>
export function renameField(
	source: string | Field | FieldDirection | Function | BinaryExpression | List<Field | FieldDirection | Function | Join> | (Field | FieldDirection | Function | Join)[],
	replace: Map<Field, Field>
): typeof source {
	const needles = Array.from(replace.keys());

	if (typeof source === 'string') {
		for (let i = 0, l = needles.length; i < l; ++i) {
			const needle = needles[i];
			if (needle.name === source) {
				return replace.get(needle)!.name;
			}
		}
		return source;
	}
	else if (source instanceof Field) {
		for (let i = 0, l = needles.length; i < l; ++i) {
			const needle = needles[i];
			if (needle.name === source.name && needle.alias === source.alias) {
				return replace.get(needle)!;
			}
		}
		return source;
	}
	else if (source instanceof FieldDirection) {
		for (let i = 0, l = needles.length; i < l; ++i) {
			const needle = needles[i];
			if (needle.name === source.field.name && needle.alias === source.field.alias) {
				return source.rename(replace.get(needle)!);
			}
		}
		return source;
	}
	else if (source instanceof Function) {
		return source.replaceArgument(arg => {
			if (arg instanceof Field) {
				return renameField(arg, replace);
			}
			else if (arg instanceof Function) {
				return renameField(arg, replace);
			}
			return arg;
		});
	}
	else if (source instanceof Binary) {
		return source.visit(op => {
			if (op instanceof Comparison) {
				return renameField(op, replace);
			}
			else {
				return renameField(op, replace);
			}
		});
	}
	else if (source instanceof Comparison) {
		const constructor = source.constructor as any;
		const args = source.args
			? source.args.withMutations(args => {
				args.forEach((arg, idx = 0) => {
					if (arg instanceof Field) {
						args.set(idx, renameField(arg, replace));
					}
					else if (arg instanceof Function) {
						args.set(idx, renameField(arg, replace));
					}
				});
			}).toList()
			: undefined;

		if (source.field instanceof Field) {
			const field = renameField(source.field, replace);
			if (field !== source.field || args !== source.args) {
				return new constructor(field, args);
			}
		}
		else {
			const field = renameField(source.field, replace);
			if (field !== source.field || args !== source.args) {
				return new constructor(field, args);
			}
		}
		return source;
	}
	else if (isArray(source)) {
		return source.map(source => renameField(source as Field, replace));
	}
	else {
		return source.withMutations((source) => {
			source.forEach((field, idx = 0) => {
				if (field instanceof Field) {
					const replaced = renameField(field, replace);
					if (replaced !== field) {
						source.set(idx, replaced);
					}
				}
				else if (field instanceof FieldDirection) {
					const replaced = renameField(field, replace);
					if (replaced !== field) {
						source.set(idx, replaced);
					}
				}
				else if (field instanceof Function) {
					const replaced = renameField(field, replace);
					if (replaced !== field) {
						source.set(idx, replaced);
					}
				}
				else if (field) {
					const { on, query } = field;
					const fields = query.fields ? renameField(query.fields, replace) : undefined;
					const joins = query.joins ? renameField(query.joins, replace) : undefined;
					const conditions = query.conditions ? renameField(query.conditions, replace) : undefined;
					const sorts = query.sorts ? renameField(query.sorts, replace) : undefined;

					const queryRenamed = fields !== query.fields || joins !== query.joins || conditions !== query.conditions || sorts !== query.sorts
						? new QuerySelect(fields, query.collection, joins, conditions, sorts, query.limit, query.offset)
						: query;
					const onRenamed = on instanceof Binary ? renameField(on, replace) : renameField(on, replace);

					if (queryRenamed !== query || onRenamed !== on) {
						source.set(idx, { alias: field.alias, on: onRenamed, query: queryRenamed });
					}
				}
			});
		});
	}
}