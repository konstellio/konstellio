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
				const userId = ctx.req.userId;
				const cache = ctx.cache;
				const { User, UserGroup } = ctx.collections;


				if (await ctx.cache.has(`auth.userRoles:${userId}`)) {
					userRoles = (await ctx.cache.get(`auth.userRoles:${userId}`) || '').toString().split(',');
				} else {
					const user = await User.findById(userId, { fields: [q.field('id'), q.field('groups')] });
					const groups = await UserGroup.findByIds(user.groups || [], { fields: [q.field('id'), q.field('roles')] });
					userRoles = groups.reduce((roles: string[], group: any) => [...roles, ...group.roles], [] as string[]);
					await cache.set(`auth.userRoles:${userId}`, userRoles.join(','));
				}
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