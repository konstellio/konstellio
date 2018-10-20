import { IResolvers } from 'graphql-tools';

export default {
	identifier: 'konstellio/server',
	async getTypeDef(): Promise<string> {
		return `
			scalar Cursor
			scalar Date
			scalar DateTime

			directive @collection(
				type: String
				indexes: [DirectiveIndex!]
			) on OBJECT | ENUM | UNION

			enum DirectiveIndexType {
				primary
				index
				unique
			}
			enum DirectiveIndexFieldDirection {
				asc
				desc
			}
			input DirectiveIndexField {
				field: String!
				direction: DirectiveIndexFieldDirection
			}
			input DirectiveIndex {
				handle: String!
				type: DirectiveIndexType!
				fields: [DirectiveIndexField]!
			}

			directive @localized on FIELD_DEFINITION
			directive @computed on FIELD_DEFINITION
			directive @hidden on FIELD_DEFINITION
			directive @inlined on FIELD_DEFINITION

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
				void: Boolean @hidden
			}

			type Mutation {
				void: Boolean @hidden
			}

			type Subscription {
				void: Boolean @hidden
			}
		`;
	},

	async getResolvers(): Promise<IResolvers> {
		return {};
	}
};