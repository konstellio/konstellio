import { Extension } from '../extension';

export default {
	typeDefs: `
		scalar Cursor
		scalar Date
		scalar DateTime
		scalar Upload

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

		type Query {
			void: Boolean @hidden
		}
		type Mutation {
			void: Boolean @hidden
		}
		type Subscription {
			void: Boolean @hidden
		}
	`,
	resolvers: {

	}
} as Extension;