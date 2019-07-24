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
			handle: String!
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
			_ImATeaPot: Boolean
		}
		type Mutation {
			_ImATeaPot: Boolean
		}
		type Subscription {
			_ImATeaPot: Boolean
		}
	`,
	resolvers: {},
} as Extension;
