"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
/**
 * Extract field selections from resolver's info
 */
function getSelectionsFromInfo(info) {
    return info.operation.selectionSet.selections.reduce((selections, selection) => {
        if (selection.kind === graphql_1.Kind.FIELD && selection.selectionSet) {
            selections.push(...getSelectionsFromSet(selection.selectionSet));
        }
        return selections;
    }, []);
}
exports.getSelectionsFromInfo = getSelectionsFromInfo;
function getSelectionsFromSet(set) {
    return set.selections.reduce((selections, selection) => {
        if (selection.kind === 'Field') {
            selections.push(selection.name.value);
        }
        else if (selection.kind === 'InlineFragment') {
            selections.push(...getSelectionsFromSet(selection.selectionSet));
        }
        return selections;
    }, []);
}
//# sourceMappingURL=resolver.js.map