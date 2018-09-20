
module.exports = {

	identifier: 'example/simple-blog',

	async getTypeDef() {
		return `
			extend type Query {
				latestPost(first: Int, after: Cursor): [PostCursor!]!
			}

			extend type Mutation {
				createPost(data: PostInput): Boolean
			}

			extend type User
			@indexes(indexes: [
				{ handle: "User_birthday", type: "index", fields: [{ field: "birthday", direction: "asc" }] }
			])
			{
				birthday: Date
				displayName: String! @computed
			}

			extend enum Group {
				Author
			}

			type PostCategory
			@collection(type: "structure")
			{
				id: ID!
				title: String! @localized
				slug: String! @localized
			}

			type Post
			@collection
			@indexes(indexes: [
				{ handle: "Post_slug", type: "unique", fields: [{ field: "slug", direction: "asc" }] }
			])
			{
				id: ID!
				title: String! @localized
				slug: String! @localized
				categories: [PostCategory!]!
				postDate: DateTime!
				expireDate: DateTime
				author: User!
				contributors: [User!]!
				content: [Content!]! @localized
			}

			type PostCursor {
				cursor: String
				item: Post!
			}

			union Content = ContentTitle | ContentText

			type ContentTitle {
				title: String!
				subtitle: String
				text: String
			}
			type ContentText {
				text: String!
			}
			type ContentGallery {
				pictures: [File!]!
			}

			extend union Content = ContentGallery
		`;
	},

	async getResolvers() {
		return {
			Query: {
				async latestPost(parent, { first, after }, { q, records }, info) {
					return [{
						cursor: 'bleh',
						item: {
							id: 'id',
							title: 'Titre',
							slug: 'titre',
							postDate: '2018-04-28 00:00:00',
							author: {
								id: 'bleh',
								username: 'mgrenier',
								group: 'Author',
								birthday: '1986-03-17'
							},
							contributors: [],
							content: []
						}
					}]
				}
			},
			User: {
				displayName: {
					fragment: `... on User { username }`,
					async resolve(parent, args, context, info) {
						// console.log(typeof info);
						return parent.username;
					}
				}
			}
		}
	}
}