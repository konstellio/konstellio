import { q } from '@konstellio/db';
import { Extension } from "./generated/konstellio/types";

export default {
	typeDefs: `
		type Post
		@collection(
			indexes: [
				{ handle: "Post_slug", type: "unique", fields: [{ handle: "slug", direction: "asc" }] }
			]
		)
		{
			id: ID!
			title: String! @localized
			slug: String! @localized
			categories: [PostCategory!]!
			postDate: DateTime!
			expireDate: DateTime
			author: User!
			contributors: [User!]!
			content: String! @localized
		}

		type PostCategory
		@collection(
			type: "structure",
			indexes: [
				{ handle: "PostCategory_slug", type: "unique", fields: [{ handle: "slug", direction: "asc" }] }
			]
		)
		{
			id: ID!
			title: String! @localized
			slug: String! @localized
		}

		type PostCursor {
			cursor: String
			item: Post!
		}


		extend type Query {
			hello: String!
			latestPost(first: Int, after: Cursor): [PostCursor!]!
		}

		# extend type Mutation {
		# 	createPost(data: PostInput): Boolean
		# }

		extend type Subscription {
			postAdded: Post
		}
	`,
	resolvers: {
		Query: {
			async hello(_, { }, context) {
				const r = await context.collection.Post.findOne({
					condition: q.eq('slug', 'hello')
				});
				return r.slug;
			}
		},
		Mutation: {
			async createPost(_, { data }, context) {
				return false;
			}
		},
		Subscription: {
			postAdded(_, { }, context) {
				return context.mq.subscribeIterator('postAdded');
			}
		}
	}
} as Extension;