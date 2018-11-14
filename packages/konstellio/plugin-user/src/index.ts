import { IResolvers, SchemaDirectiveVisitor } from 'graphql-tools';
import { PermissionDirective } from './permissionDirective';
import { Server, Plugin, Request, Response } from '@konstellio/server';
import { q } from '@konstellio/db';
import { hash, compare } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { AuthenticationError } from 'apollo-server-core';

export default {
	identifier: 'konstellio/plugin-user',
	async getTypeDef(): Promise<string> {
		return `
			directive @permission(
				role: String
				roles: [String!]
			) on FIELD_DEFINITION
			
			type UserGroup
			@collection
			{
				id: ID!
				name: String!
				roles: [String!]!
			}

			type User
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
		`;
	},

	async getDirectives(): Promise<Record<string, typeof SchemaDirectiveVisitor>> {
		return {
			permission: PermissionDirective
		};
	},

	async getResolvers(): Promise<IResolvers> {
		return {
			Query: {
				async me(_, {  }, { req, collections: { User } }) {
					// console.log(getSelectionsFromInfo(info));
					const user = await User.findById(req.userId);
					return user;
				}
			},
			Mutation: {
				async login(_, { username, password }, { collections: { User, UserGroup }, cache, config }) {
					try {
						const user = await User.findOne({
							fields: [q.field('id'), q.field('password')],
							condition: q.eq(q.field('username'), username)
						});

						if (await comparePassword(password, user.password)) {
							const token = sign({ userid: user.id }, config.secret);
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

	async setupRoutes(server: Server): Promise<void> {
		const { cache } = server;
		const { User, UserGroup } = server.collections;
		server.app!.addHook('preHandler', async (request: any, response: any) => {
			const authorization = request.req.headers['authorization'];
			if (authorization && authorization.substr(0, 6) === 'Bearer') {
				const token = authorization.substr(7);
				try {
					const { userid: userId } = verify(token, server.config.secret) as any;

					let userGroups: string[] = [];
					if (await cache.has(`auth.userGroups:${userId}`)) {
						userGroups = (await cache.get(`auth.userGroups:${userId}`) || '').toString().split(',');
					} else {
						const user = await User.findById(userId, { fields: [q.field('id'), q.field('groups')] });
						userGroups = user.groups;
						await cache.set(`auth.userGroups:${userId}`, userGroups.join(','));
					}

					const groupRoles = await Promise.all(userGroups.map(groupId => new Promise<string[]>(async (resolve, reject) => {
						if (await cache.has(`auth.groupRoles:${groupId}`)) {
							return resolve(await (await cache.get(`auth.groupRoles:${groupId}`) || '').toString().split(','));
						}
						const group = await UserGroup.findById(groupId, { fields: [q.field('id'), q.field('roles')] });
						const roles: string[] = group.roles || [];
						await cache.set(`auth.groupRoles:${groupId}`, roles.join(','));
						resolve(roles);
					})));

					request.userId = userId;
					request.userRoles = groupRoles.reduce((roles, groupRoles) => [...roles, ...groupRoles], []);
				} catch (err) {}
			}
		});
	},

	async setupContext(server: Server, request: Request, response: Response): Promise<any> {
		return {
			userId: request.userId || undefined,
			userRoles: request.userRoles || undefined,
		};
	}
} as Plugin;

export async function hashPassword(password: string): Promise<string> {
	return hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
	return compare(password, hash);
}