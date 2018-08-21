import { GraphQLResolveInfo } from "graphql";
/**
 * Extract field selections from resolver's info
 */
export declare function getSelectionsFromInfo(info: GraphQLResolveInfo): string[];
