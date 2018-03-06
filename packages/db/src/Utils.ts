import { Binary, Comparison, Field, FieldDirection, Join, Query } from './Query';
import { List } from 'immutable';

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

export function renameFieldInQuery(
	query: Query,
	replace: Map<Field, Field>
): typeof query {

	return query;
}

export function renameField(
	source: Field | FieldDirection | Join | Binary | Comparison,
	replace: Map<Field, Field>
): typeof source {
	// if (source instanceof Binary) {
	// 	return source;
	// }
	// if (source instanceof Comparison) {
	// 	return source;
	// }
	// else {
	// 	return source.withMutations((source) => {
	// 		source.forEach((field, idx = 0) => {
	// 			if (field instanceof Field) {
	// 				if (field.alias === undefined) {
	// 					if (replace.has(field.name)) {
	// 						fields.set(idx, replace.get(field.name)!);
	// 					}
	// 				}
	// 			}
	// 			else if (field instanceof FieldDirection) {
	// 				if (field.field.alias === undefined) {
	// 					if (replace.has(field.field.name)) {
	// 						fields.set(idx, field.rename(replace.get(field.field.name)!));
	// 					}
	// 				}
	// 			}
	// 			else if (field) {
	// 				field...
	// 			}
	// 		});
	// 	});
	// }
	return source;
}