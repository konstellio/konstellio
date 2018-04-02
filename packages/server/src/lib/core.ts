import { Plugin, PluginInitContext } from '../utils/plugin';

export default {
	async graphql(context) {
		return `
			scalar Cursor
			scalar Date
			scalar DateTime
			type User @record {
				id: ID!
				username: String! @field(label: "Username", type: "text", field: "text")
				password: String! @field(label: "Password", type: "text", field: "password") @permission(group: "noone")
			}
			type File @record {
				id: ID!
				path: String! @field(type: "text")
				name: String! @field(type: "text")
				size: Int! @field(type: "int")
				creation: DateTime! @field(type: "datetime")
				modification: DateTime! @field(type: "datetime")
			}
			type Relation @record(indexes: [
				{ handle: "Relation_collection", type: "index", fields: { id: "asc", collection: "asc" } },
				{ handle: "Relation_field", type: "index", fields: { id: "asc", collection: "asc", field: "asc" } },
				{ handle: "Relation_source", type: "index", fields: { id: "asc", source: "asc", seq: "asc" } },
				{ handle: "Relation_target", type: "index", fields: { id: "asc", target: "asc" } }
			]) {
				id: ID!
				collection: String! @field(type: "text")
				field: String! @field(type: "text")
				source: ID! @field(type: "text")
				target: ID! @field(type: "text")
				seq: String! @field(type: "int")
			}
			type Query {
				me: User!
			}
			type Mutation {
				login(username: String!, password: String!): LoginResponse @permission(group: "nobody")
				logout: LogoutResponse @permission(group: "any")
			}
			type LoginResponse {
				token: String!
			}
			type LogoutResponse {
				acknowledge: Boolean!
			}
		`;
	},
	async resolvers() {
		return {
			Query: {
				async me() {
					return {
						id: 'needs-an-ID',
						username: 'someone'
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
		};
	}
} as Plugin;