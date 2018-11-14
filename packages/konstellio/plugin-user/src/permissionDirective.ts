import { SchemaDirectiveVisitor } from "graphql-tools";
import { GraphQLField, GraphQLObjectType, GraphQLInterfaceType } from "graphql";
import { AuthenticationError } from "apollo-server-core";
import { isArray } from "util";
import { q } from '@konstellio/db';


export class PermissionDirective extends SchemaDirectiveVisitor {
	visitFieldDefinition(
		field: GraphQLField<any, any>,
		details: {
			objectType: GraphQLObjectType | GraphQLInterfaceType
		}
	): GraphQLField<any, any> | void | null {
		const { resolve } = field;

		const roles: string[] = [];
		if (this.args.role) {
			roles.push(this.args.role);
		}
		if (this.args.roles && isArray(this.args.roles)) {
			roles.push(...this.args.roles);
		}

		field.resolve = async function PermissionDirectiveResolver (obj, args, ctx, info) {
			let userRoles: string[] = ['auth.loggedout'];

			if (ctx.req && ctx.req.userId) {
				userRoles = ctx.req.userRoles;
			}

			if (userRoles.indexOf('super') === -1 && roles.filter(role => userRoles.indexOf(role) === -1).length > 0) {
				throw new AuthenticationError(`You do not possess to required roles to access this resource.`);
			}
			if (resolve) {
				return resolve(obj, args, ctx, info);
			}
		};
	}
}