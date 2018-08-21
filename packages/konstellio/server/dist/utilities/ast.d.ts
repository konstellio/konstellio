import { DocumentNode, DefinitionNode, TypeDefinitionNode, FieldDefinitionNode, TypeNode, ArgumentNode, ValueNode } from "graphql";
/**
 * Merge multiple DocumentNode into one, collapsing type extension into their type definition
 */
export declare function mergeAST(documents: DocumentNode[]): DocumentNode;
export declare function getDefNodeByNamedType(ast: DocumentNode, name: string): DefinitionNode | undefined;
export declare function isTypeDefinitionNode(node: any): node is TypeDefinitionNode;
export declare function isTypeExtensionNode(node: any): boolean;
export declare function buildTypeName(type: TypeNode): string;
export declare function isCollection(node: DefinitionNode): boolean;
export declare function isComputedField(node: FieldDefinitionNode): boolean;
export declare function isLocalizedField(node: FieldDefinitionNode): boolean;
export declare function getNamedTypeNode(type: TypeNode): string;
export declare function isNonNullType(type: TypeNode): boolean;
export declare function isListType(type: TypeNode): boolean;
export declare function getValue(node: ValueNode): any;
export declare function getArgumentsValues(nodes: ArgumentNode[] | undefined): {
    [key: string]: any;
};
