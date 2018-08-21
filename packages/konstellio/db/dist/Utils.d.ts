import { Binary, Field, BinaryExpression } from './Query';
export declare function simplifyBinaryTree(node: Binary): Binary;
export declare class QueryTooComplexeError extends Error {
}
export declare function decomposeBinaryTree(tree: Binary): BinaryExpression[];
export declare function replaceField(source: any, replace: Map<Field, Field>, matches?: Field[]): typeof source;
