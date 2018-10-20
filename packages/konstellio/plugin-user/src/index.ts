import { IResolvers, SchemaDirectiveVisitor } from 'graphql-tools';
import { PermissionDirective } from './permissionDirective';
import { Server, Plugin, Request, Response } from '@konstellio/server';

export default {
	identifier: 'konstellio/plugin-user',
	async getTypeDef(): Promise<string> {
		return `
			directive @permission(
				group: String
				groups: [String!]
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
				login(username: String!, password: String!): LoginResponse	@permission(group: "nobody")
				logout: LogoutResponse										@permission(role: "auth.loggedin")
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
				async me() {
					// console.log(getSelectionsFromInfo(info));
					return {
						id: 'bleh',
						username: 'mgrenier',
						group: 'Author',
						birthday: '1986-03-17'
					};
				}
			},
			Mutation: {
				async login(_, { username, password }, { }) {
					return {
						token: `${username}:${password}`
					};
				},
				async logout(_, { }, { }) {
					return {
						acknowledge: true
					};
				}
			}
		};
	},

	async setupRoutes(server: Server): Promise<void> {
		server.app!.addHook('preHandler', async (request: any, response: any) => {
			const authorization = request.req.headers['authorization'];
			if (authorization && authorization.substr(0, 6) === 'Bearer') {
				const token = authorization.substr(7);
				if (server.cache.has(`auth.token:${token}`)) {
					const userId = await server.cache.get(`auth.token.${token}`);
					if (userId) {
						// let userGroups = await server.cache.get(`auth.userGroups.${userId}`);
						request.userId = userId;
						request.userGroups = [];
						request.userRoles = [];
					}
					return;
				}
			}
		});
	},

	async setupContext(server: Server, request: Request, response: Response): Promise<any> {
		return {
			userId: request.userId,
			userGroups: request.userGroups,
			userRoles: request.userRoles
		};
	}
} as Plugin;