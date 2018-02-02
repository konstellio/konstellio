import { IResolvers } from '../lib/interfaces';

export default async function (): Promise<IResolvers> {
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
			async login(parent, { username, password }, { db, cache }) {
				return {
					token: `${username}:${password}`
				};
			},
			async logout(parent, {}, { db, cache }) {
				return {
					acknowledge: true
				};
			}
		}
	};
}