import { IResolvers, IResolverObject } from "graphql-tools";
import { DocumentNode, Kind } from "graphql";
import { Locales } from "../../server";
import { gatherObjectFields } from "../../collection";
import { isCollection } from "../utilities/ast";
import { getSelectionsFromInfo } from "../utilities/resolver";
import { q } from "@konstellio/db";

export function createDefaultResolvers(ast: DocumentNode, locales: Locales): IResolvers {
	const resolvers: IResolvers = {};

	ast.definitions.forEach(node => {
		if (node.kind === Kind.OBJECT_TYPE_DEFINITION && isCollection(node)) {
			const fieldMetas = gatherObjectFields(ast, node);
			const relationFields = fieldMetas.filter(meta => meta.isRelation);
			const fieldResolvers = relationFields.reduce((resolvers, relation) => {
				resolvers[relation.handle] = (obj, args, { collections }, info) => {
					const selections = getSelectionsFromInfo(info);
					return collections[relation.type].findByIds(obj[relation.handle], { fields: selections.map(handle => q.field(handle)) });
				};
				return resolvers;
			}, {} as IResolverObject);

			resolvers[node.name.value] = fieldResolvers;
		}
	});

	return resolvers;
}