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

export function replaceField(source: string, replace: Map<Field, Field>, matches?: Field[]): string
export function replaceField(source: Field, replace: Map<Field, Field>, matches?: Field[]): Field
export function replaceField(source: FieldDirection, replace: Map<Field, Field>, matches?: Field[]): FieldDirection
export function replaceField(source: Function, replace: Map<Field, Field>, matches?: Field[]): Function
export function replaceField(source: Binary, replace: Map<Field, Field>, matches?: Field[]): Binary
export function replaceField(source: Comparison, replace: Map<Field, Field>, matches?: Field[]): Comparison
export function replaceField(source: Field[], replace: Map<Field, Field>, matches?: Field[]): Field[]
export function replaceField(source: FieldDirection[], replace: Map<Field, Field>, matches?: Field[]): FieldDirection[]
export function replaceField(source: Function[], replace: Map<Field, Field>, matches?: Field[]): Function[]
export function replaceField(source: Join[], replace: Map<Field, Field>, matches?: Field[]): Join[]
export function replaceField(source: List<Field>, replace: Map<Field, Field>, matches?: Field[]): List<Field>
export function replaceField(source: List<FieldDirection>, replace: Map<Field, Field>, matches?: Field[]): List<FieldDirection>
export function replaceField(source: List<Function>, replace: Map<Field, Field>, matches?: Field[]): List<Function>
export function replaceField(source: List<Join>, replace: Map<Field, Field>, matches?: Field[]): List<Join>
export function replaceField(
	source: string | Field | FieldDirection | Function | BinaryExpression | List<Field | FieldDirection | Function | Join> | (Field | FieldDirection | Function | Join)[],
	replace: Map<Field, Field>,
	matches: Field[] = []
): typeof source {
	const needles = Array.from(replace.keys());

	if (typeof source === 'string') {
		for (let i = 0, l = needles.length; i < l; ++i) {
			const needle = needles[i];
			if (needle.name === source) {
				if (matches.indexOf(needle) === -1) {
					matches.push(needle);
				}
				return replace.get(needle)!.name;
			}
		}
		return source;
	}
	else if (source instanceof Field) {
		for (let i = 0, l = needles.length; i < l; ++i) {
			const needle = needles[i];
			if (needle.name === source.name && needle.alias === source.alias) {
				if (matches.indexOf(needle) === -1) {
					matches.push(needle);
				}
				return replace.get(needle)!;
			}
		}
		return source;
	}
	else if (source instanceof FieldDirection) {
		for (let i = 0, l = needles.length; i < l; ++i) {
			const needle = needles[i];
			if (needle.name === source.field.name && needle.alias === source.field.alias) {
				if (matches.indexOf(needle) === -1) {
					matches.push(needle);
				}
				return source.rename(replace.get(needle)!);
			}
		}
		return source;
	}
	else if (source instanceof Function) {
		return source.replaceArgument(arg => {
			if (arg instanceof Field || arg instanceof Function) {
				return replaceField(arg as Field, replace, matches);
			}
			return arg;
		});
	}
	else if (source instanceof Binary) {
		return source.visit(op => {
			return replaceField(op as Comparison, replace, matches);
		});
	}
	else if (source instanceof Comparison) {
		const constructor = source.constructor as any;
		const args = source.args
			? source.args.withMutations(args => {
				args.forEach((arg, idx = 0) => {
					if (arg instanceof Field || arg instanceof Function) {
						args.set(idx, replaceField(arg as Field, replace, matches));
					}
				});
			}).toList()
			: undefined;

		const field = replaceField(source.field as Field, replace, matches);
		if (field !== source.field || args !== source.args) {
			return new constructor(field, args);
		}
		return source;
	}
	else if (isArray(source)) {
		return source.map(source => replaceField(source as Field, replace, matches));
	}
	else {
		return source.withMutations((source) => {
			source.forEach((field, idx = 0) => {
				if (field instanceof Field || field instanceof FieldDirection || field instanceof Function) {
					const replaced = replaceField(field as Field, replace, matches);
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
						? new QuerySelect(fields, query.collection, joins, conditions, sorts, query.limit, query.offset)
						: query;
					const onRenamed = on instanceof Binary ? replaceField(on, replace, matches) : replaceField(on, replace, matches);

					if (queryRenamed !== query || onRenamed !== on) {
						source.set(idx, { alias: field.alias, on: onRenamed, query: queryRenamed });
					}
				}
			});
		});
	}
}