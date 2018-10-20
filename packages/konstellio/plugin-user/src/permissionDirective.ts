import { SchemaDirectiveVisitor } from "graphql-tools";
import { GraphQLField, GraphQLObjectType, GraphQLInterfaceType } from "graphql";
import { AuthenticationError } from "apollo-server-core";


export class PermissionDirective extends SchemaDirectiveVisitor {
	visitFieldDefinition(
		field: GraphQLField<any, any>,
		details: {
			objectType: GraphQLObjectType | GraphQLInterfaceType
		}
	): GraphQLField<any, any> | void | null {
		const { resolve } = field;
		const { role } = this.args;
		field.resolve = async function PermissionDirectiveResolver (obj, args, { req }) {
			// if (!req || !req.user) {
				throw new AuthenticationError(`You must be signed in to view this resource.`);
			// }

			// if (req.user.)
		};
	}
}