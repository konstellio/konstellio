import { Plugin } from '../plugin';
import { IResolvers } from 'graphql-tools';
import { Server } from '../server';
import { DocumentNode } from 'graphql';

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

			type Relation
			@collection
			@index(handle: "Relation_collection", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "collection", direction: "asc" }])
			@index(handle: "Relation_field", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "collection", direction: "asc" }, { field: "field", direction: "asc" }])
			@index(handle: "Relation_source", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "source", direction: "asc" }, { field: "seq", direction: "asc" }])
			@index(handle: "Relation_target", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "target", direction: "asc" }])
			{
				id: ID!
				collection: String!
				field: String!
				source: ID!
				target: ID!
				seq: String!
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
				async me(parent, args, context, info) {
					// console.log(getSelectionsFromInfo(info));
					return {
						id: 'bleh',
						username: 'mgrenier',
						group: 'Author',
						birthday: '1986-03-17'
					}
				}
			},
			Mutation: {
				async login(parent, { username, password }, { database, cache }) {
					return {
						token: `${username}:${password}`
					};
				},
				async logout(parent, { }, { database, cache }) {
					return {
						acknowledge: true
					};
				}
			}
		}
	}
}