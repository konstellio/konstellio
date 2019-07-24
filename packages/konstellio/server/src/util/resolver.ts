import { GraphQLResolveInfo, SelectionSetNode, Kind } from 'graphql';

/**
 * Extract field selections from resolver's info
 */
export function getSelectionsFromInfo(info: GraphQLResolveInfo): string[] {
	return info.fieldNodes[0].selectionSet!.selections.reduce(
		(selections, selection) => {
			if (selection.kind === Kind.FIELD) {
				selections.push(selection.name.value);
			} else if (selection.kind === Kind.INLINE_FRAGMENT) {
				selections.push(...getSelectionsFromSet(selection.selectionSet));
			}
			return selections;
		},
		[] as string[]
	);
}

function getSelectionsFromSet(set: SelectionSetNode): string[] {
	return set.selections.reduce(
		(selections, selection) => {
			if (selection.kind === 'Field') {
				selections.push(selection.name.value);
			} else if (selection.kind === 'InlineFragment') {
				selections.push(...getSelectionsFromSet(selection.selectionSet));
			}
			return selections;
		},
		[] as string[]
	);
}
