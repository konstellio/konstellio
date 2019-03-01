import { SchemaDirectiveVisitor } from "graphql-tools";
import { GraphQLField, GraphQLObjectType, GraphQLInterfaceType } from "graphql";
import { AuthenticationError } from "apollo-server-core";
import { isArray } from "util";
import { hash, compare } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { q } from '@konstellio/db';
import { Collection } from '@konstellio/odm';
import { getSelectionsFromInfo } from "../util/resolver";
import { Context, Extension } from "../extension";
import { User, UserIndexes, UserGroup, UserGroupIndexes } from "./schema";

class PermissionDirective extends SchemaDirectiveVisitor {
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

async function hashPassword(password: string): Promise<string> {
	return hash(password, 10);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
	return compare(password, hash);
}

export interface AuthContext extends Context {
	userId?: string;
	userRoles?: string[];
	collection: {
		User: Collection<User, UserIndexes>,
		UserGroup: Collection<UserGroup, UserGroupIndexes>,
	};
}

export default {
	typeDefs: `
		directive @permission(
			role: String
			roles: [String!]
		) on FIELD_DEFINITION
		
		type UserGroup implements Node
		@collection
		{
			id: ID!
			name: String!
			roles: [String!]!
		}
		
		type User implements Node
		@collection(
			indexes: [
				{ handle: "User_username", type: "unique", fields: [{ field: "username", direction: "asc" }] }
			]
		)
		{
			id: ID!
			username: String!
			password: String! @hidden
			groups: [UserGroup!]!
		}
		
		type LoginResponse {
			token: String!
		}
		type LogoutResponse {
			acknowledge: Boolean!
		}
		
		extend type Query {
			me: User!		@permission(role: "auth.loggedin")
		}
		
		extend type Mutation {
			login(username: String!, password: String!): LoginResponse	@permission(role: "auth.loggedout")
		}
	`,
	directives: {
		permission: PermissionDirective
	},
	resolvers({ secret }) {
		return {
			Query: {
				async me(_, {  }, { userId, collection: { User } }, info) {
					if (!userId) {
						throw new AuthenticationError(`Not authenticated.`);
					}
					const selections: any[] = getSelectionsFromInfo(info);
					const user = await User.findById(userId, { fields: selections });
					return user;
				}
			},
			Mutation: {
				async login(_, { username, password }, { collection: { User } }) {
					try {
						const user = await User.findOne({
							fields: ['id', 'password'],
							condition: q.eq('username', username)
						});

						if (await comparePassword(password, user.password)) {
							const token = sign({ userid: user.id }, secret);
							return {
								token
							};
						}
					} catch (err) {}

					throw new AuthenticationError(`Could not authenticate. Please try again later.`);
				}
			}
		};
	},
	main(app, { secret }) {
		app.addHook('preHandler', async (request, response) => {
			const { context } = request;
			const { cache, collection: { User, UserGroup } } = context;
			const authorization = request.req.headers['authorization'];
			if (authorization && authorization.substr(0, 6) === 'Bearer') {
				const token = authorization.substr(7);
				try {
					const { userid: userId } = verify(token, secret) as any;

					let userGroups: string[] = [];
					if (await cache.has(`auth.userGroups:${userId}`)) {
						userGroups = (await cache.get(`auth.userGroups:${userId}`) || '').toString().split(',');
					} else {
						const user = await User.findById(userId, { fields: ['id', 'groups'] });
						userGroups = user.groups;
						await cache.set(`auth.userGroups:${userId}`, userGroups.join(','));
					}

					const groupRoles = await Promise.all(userGroups.map(groupId => new Promise<string[]>(async (resolve, reject) => {
						if (await cache.has(`auth.groupRoles:${groupId}`)) {
							return resolve(await (await cache.get(`auth.groupRoles:${groupId}`) || '').toString().split(','));
						}
						const group = await UserGroup.findById(groupId, { fields: ['id', 'roles'] });
						const roles: string[] = group.roles || [];
						await cache.set(`auth.groupRoles:${groupId}`, roles.join(','));
						resolve(roles);
					})));

					context.userId = userId;
					context.userRoles = groupRoles.reduce((roles, groupRoles) => [...roles, ...groupRoles], []);
				} catch (err) {}
			}
		});
	}
} as Extension<AuthContext>;