export const baseSchema = `
	scalar ID
	scalar Cursor
	scalar Date
	scalar DateTime

	directive @indexes(
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

	interface Node {
		id: ID!
	}

	type Query {
		_ImATeaPot: Boolean
	}

	type Mutation {
		_ImATeaPot: Boolean
	}

	type Subscription {
		_ImATeaPot: Boolean
	}
`;