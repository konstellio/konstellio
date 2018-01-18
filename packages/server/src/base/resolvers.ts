export default async function () {
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
			async login(parent, { username, password }, context, info) {
				return {
					token: "what-token?"
				};
			},
			async logout() {
				return {
					acknowledge: true
				};
			}
		}
	};
}