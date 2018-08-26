import { IResolvers } from 'graphql-tools';

export default {
	identifier: 'konstellio/core',
	async getTypeDef(): Promise<string> {
		return `
			scalar Cursor
			scalar Date
			scalar DateTime

			enum Group {
				Guest
			}

			type User
			@collection
			@index(handle: "User_username", type: "unique", fields: [{ field: "username", direction: "asc" }])
			{
				id: ID!
				username: String!
				password: String!
				group: Group
			}

			type File
			@collection
			{
				id: ID!
				path: String!
				name: String!
				size: Int!
				creation: DateTime!
				modification: DateTime!
			}

			type Query {
				me: User!
			}

			type Mutation {
				login(username: String!, password: String!): LoginResponse
				logout: LogoutResponse
				createUser(data: UserInput): Boolean
			}

			type LoginResponse {
				token: String!
			}
			type LogoutResponse {
				acknowledge: Boolean!
			}
		`;
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
	}
};