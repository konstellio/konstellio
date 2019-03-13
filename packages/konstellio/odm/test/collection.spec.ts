import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Schema, Collection } from '../src/index';
import { q, ColumnType, IndexType } from '@konstellio/db';
import { DatabaseSQLite } from '@konstellio/db-sqlite';


describe('Collection', () => {

	const postCatSchema: Schema = {
		handle: 'PostCategory',
		fields: [
			{ handle: 'id', type: 'string' },
			{ handle: 'title', type: 'string', required: true },
		],
		indexes: []
	};
	const postSchema: Schema = {
		handle: 'Post',
		fields: [
			{ handle: 'id', type: 'string' },
			{ handle: 'title', type: 'string', localized: true, required: true },
			{ handle: 'slug', type: 'string', localized: true, required: true },
			{ handle: 'category', type: postCatSchema, localized: true, relation: true, multiple: true, required: true },
			{ handle: 'postDate', type: 'datetime' },
		],
		indexes: [
			{ handle: 'post_id', type: 'primary', fields: [{ handle: 'id' }] },
			{ handle: 'post_slug', type: 'unique', fields: [{ handle: 'slug' }] },
			{ handle: 'post_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'desc' }] }
		]
	};
	const productSchema: Schema = {
		handle: 'Product',
		objects: [
			{
				handle: 'Physical',
				fields: [
					{ handle: 'id', type: 'string' },
					{ handle: '_type', type: 'string', required: true },
					{ handle: 'sku', type: 'string', required: true },
					{ handle: 'title', type: 'string', localized: true, required: true },
					{ handle: 'price', type: 'float', required: true },
					{ handle: 'weight', type: 'float' },
					{ handle: 'width', type: 'float' },
					{ handle: 'height', type: 'float' },
					{ handle: 'depth', type: 'float' },
				]
			}, {
				handle: 'Virtual',
				fields: [
					{ handle: 'id', type: 'string' },
					{ handle: '_type', type: 'string', required: true },
					{ handle: 'sku', type: 'string', required: true },
					{ handle: 'title', type: 'string', localized: true, required: true },
					{ handle: 'price', type: 'float', required: true },
					{ handle: 'size', type: 'float' }
				]
			}
		],
		indexes: [
			{ handle: 'primary', type: 'primary', fields: [{ handle: 'id' }] },
			{ handle: 'sku', type: 'unique', fields: [{ handle: 'sku' }] },
			{ handle: 'price', type: 'sparse', fields: [{ handle: 'price' }] },
		]
	};

	interface PostCategoryFields {
		id: string;
		title: string;
	}

	interface PostCategoryIndexes {
		id: string;
		slug: string;
	}

	interface PostCategoryInputs {
		title: string;
	}

	interface PostFields {
		id: string;
		title: string;
		slug: string;
		category: string[];
		postDate: Date;
	}

	interface PostIndexes {
		id: string;
		slug: string;
		postDate: Date;
	}

	interface PostInputs {
		id?: string;
		title: { fr: string, en: string };
		slug: { fr: string, en: string };
		category: { fr: string[], en: string[] };
		postDate: Date;
	}

	type ProductFields = ProductPhysicalFields | ProductVirtualFields;

	interface ProductPhysicalFields {
		id: string;
		_type: 'physical';
		sku: string;
		title: string;
		price: number;
		weight?: number;
		width?: number;
		height?: number;
		depth?: number;
	}

	interface ProductVirtualFields {
		id: string;
		_type: 'virtual';
		sku: string;
		title: string;
		price: number;
		size?: number;
	}

	interface ProductIndexes {
		id: string;
		sku: string;
		price: number;
	}

	type ProductInputs = ProductPhysicalInputs | ProductVirtualInputs;

	interface ProductPhysicalInputs {
		id?: string;
		_type: 'physical';
		sku: string;
		title: { fr: string, en: string };
		price: number;
		weight?: number;
		width?: number;
		height?: number;
		depth?: number;
	}

	interface ProductVirtualInputs {
		id?: string;
		_type: 'virtual';
		sku: string;
		title: { fr: string, en: string };
		price: number;
		size?: number;
	}

	let db: DatabaseSQLite;

	before(function (done) {
		this.timeout(10000);

		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'konstellio-db-sqlite-'));

		db = new DatabaseSQLite({
			// filename: ':memory:'
			filename: path.join(tmp, 'test.sqlite')
		});

		db.connect()
		.then(() => db.transaction())
		.then(transaction => {
			transaction.execute(q.createCollection('Post').define([
				q.column('id', ColumnType.Text),
				q.column('title__fr', ColumnType.Text),
				q.column('title__en', ColumnType.Text),
				q.column('slug__fr', ColumnType.Text),
				q.column('slug__en', ColumnType.Text),
				q.column('postDate', ColumnType.Text)
			], [
				q.index('post_pk', IndexType.Primary, [q.sort('id')]),
				q.index('post_slug__fr_u', IndexType.Unique, [q.sort('slug__fr')]),
				q.index('post_slug__en_u', IndexType.Unique, [q.sort('slug__en')]),
				q.index('post_postDate', IndexType.Index, [q.sort('postDate')])
			]));
			transaction.execute(q.insert('Post')
				.add({
					id: 'post-a',
					title__fr: 'Mon titre 1',
					title__en: 'My title 1',
					slug__fr: 'mon-titre-1',
					slug__en: 'my-title-1',
					postDate: '2018-11-26 17:00:00'
				})
				.add({
					id: 'post-b',
					title__fr: 'Mon titre 2',
					title__en: 'My title 2',
					slug__fr: 'mon-titre-2',
					slug__en: 'my-title-2',
					postDate: '2018-11-27 17:00:00'
				})
				.add({
					id: 'post-c',
					title__fr: 'Mon titre 3',
					title__en: 'My title 3',
					slug__fr: 'mon-titre-3',
					slug__en: 'my-title-3',
					postDate: '2018-11-28 17:00:00'
				})
			);
			transaction.execute(q.createCollection('PostCategory').define([
				q.column('id', ColumnType.Text),
				q.column('title__fr', ColumnType.Text),
				q.column('title__en', ColumnType.Text)
			], [
				q.index('postcategory_pk', IndexType.Primary, [q.sort('id')])
			]));
			transaction.execute(q.insert('PostCategory')
				.add({
					id: 'cat-a',
					title__fr: 'Ma catégorie 1',
					title__en: 'My category 1'
				})
				.add({
					id: 'cat-b',
					title__fr: 'Ma catégorie 2',
					title__en: 'My category 2'
				})
			);
			transaction.execute(q.createCollection('Relation').define([
				q.column('id', ColumnType.Text),
				q.column('collection', ColumnType.Text),
				q.column('field', ColumnType.Text),
				q.column('source', ColumnType.Text),
				q.column('target', ColumnType.Text),
				q.column('seq', ColumnType.Int)
			], [
				q.index('relation_pk', IndexType.Primary, [q.sort('id')]),
				q.index('relation_collection', IndexType.Index, [q.sort('collection')]),
				q.index('relation_field', IndexType.Index, [q.sort('field')]),
				q.index('relation_source', IndexType.Index, [q.sort('source')])
			]));
			transaction.execute(q.insert('Relation')
				.add({
					id: 'post-a-cat-a',
					collection: 'Post',
					field: 'category__fr',
					source: 'post-a',
					target: 'cat-a',
					seq: 0
				})
				.add({
					id: 'post-b-cat-a',
					collection: 'Post',
					field: 'category__fr',
					source: 'post-b',
					target: 'cat-a',
					seq: 0
				})
				.add({
					id: 'post-b-cat-b',
					collection: 'Post',
					field: 'category__fr',
					source: 'post-b',
					target: 'cat-b',
					seq: 1
				})
			);
			transaction.execute(q.createCollection('Product').define([
				q.column('id', ColumnType.Text),
				q.column('_type', ColumnType.Text),
				q.column('sku', ColumnType.Text),
				q.column('title__fr', ColumnType.Text),
				q.column('title__en', ColumnType.Text),
				q.column('price', ColumnType.Float),
				q.column('weight', ColumnType.Float),
				q.column('width', ColumnType.Float),
				q.column('height', ColumnType.Float),
				q.column('depth', ColumnType.Float),
				q.column('size', ColumnType.Float)
			], [
				q.index('product_pk', IndexType.Primary, [q.sort('id')]),
				q.index('product_sku', IndexType.Unique, [q.sort('sku')]),
				q.index('product_price', IndexType.Index, [q.sort('price')])
			]));
			transaction.execute(q.insert('Product').add({
				id: 'product-a',
				_type: 'physical',
				sku: 'a-sku',
				title__fr: 'Produit physique A',
				title__en: 'Physical produit A',
				price: 10.00,
				weight: 11,
				width: 12,
				height: 13,
				depth: 14
			}));
			transaction.execute(q.insert('Product').add({
				id: 'product-b',
				_type: 'virtual',
				sku: 'b-sku',
				title__fr: 'Produit virtuel B',
				title__en: 'Virtual produit A',
				price: 10.00,
				size: 11.00
			}));
			return transaction.commit();
		})
		.then(() => done());
	});

	it('initialize', async () => {
		expect(() => new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema)).to.not.throw();
		expect(() => new Collection<ProductFields, ProductIndexes, ProductInputs>(db, ['fr', 'en'], productSchema)).to.not.throw();
		expect(() => new Collection(db, ['fr', 'en'], postSchema)).to.not.throw();
		expect(() => new Collection(db, [], postSchema)).to.not.throw();
		expect(() => new Collection<ProductFields, ProductIndexes, ProductInputs>(db, ['fr', 'en'], productSchema, ['_type'])).to.not.throw();
	});

	it('findById', async () => {
		const Post = new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema);

		const b = await Post.findById('post-b');
		expect(b.id).to.eq('post-b');
		expect(b.title).to.eq('Mon titre 2');
		expect(b.slug).to.eq('mon-titre-2');
		expect(b.category).to.eql(['cat-a', 'cat-b']);
		expect(b.postDate).to.eql(new Date('2018-11-27 17:00:00'));

		expect(Post.findById('non-existing')).to.be.rejected;

		const c = await Post.findById('post-c', { fields: ['id', 'title'], locale: 'en' });
		expect(c.id).to.eq('post-c');
		expect(c.title).to.eq('My title 3');
		expect((c as any).slug).to.eq(undefined);

		const Product = new Collection<ProductFields, ProductIndexes, ProductInputs>(db, ['fr', 'en'], productSchema, ['_type']);
		
		const d = await Product.findById('product-a');
		expect(d.id).to.eq('product-a');
		expect(d._type).to.eq('physical');
	});

	it('findByIds', async () => {
		const Post = new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema);

		const [b, a] = await Post.findByIds(['post-b', 'post-a'], { fields: ['id', 'title'], locale: 'en'});
		expect(a.id).to.eq('post-a');
		expect(a.title).to.eq('My title 1');
		expect(b.id).to.eq('post-b');
		expect(b.title).to.eq('My title 2');
	});

	it('findOne', async () => {
		const Post = new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema);

		const a = await Post.findOne({ fields: ['id'], sort: [q.sort('slug')] });
		expect(a.id).to.eq('post-a');

		const b = await Post.findOne({ fields: ['id'], condition: q.eq('slug', 'mon-titre-2') });
		expect(b.id).to.eq('post-b');

		const c = await Post.findOne({ fields: ['id'], sort: [q.sort('slug', 'desc')] });
		expect(c.id).to.eq('post-c');
	});

	it('findMany', async () => {
		const Post = new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema);

		const [a, b] = await Post.findMany({ fields: ['id'], sort: [q.sort('id')], limit: 2 });
		expect(a.id).to.eq('post-a');
		expect(b.id).to.eq('post-b');

		const res = await Post.findMany({ fields: ['id'], condition: q.or(q.eq('id', 'post-a'), q.eq('id', 'post-b')), sort: [q.sort('id')], offset: 1 });
		expect(res.length).to.eq(1);
		expect(res[0].id).to.eq('post-b');
	});

	it('validate', async () => {
		const Post = new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema);

		expect(Post.validate({})).to.eq(false);
		expect(Post.validate({
			title: {
				fr: 'Mon titre 4',
				en: 'My title 4'
			},
			slug: {
				fr: 'mon-titre-4',
				en: 'My-title-4'
			},
			category: {
				fr: ['cat-a'],
				en: ['cat-a']
			},
			postDate: new Date()
		})).to.eq(true);
	});

	it('create', async () => {
		const Post = new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema);
		const createData = {
			title: {
				fr: 'Mon titre 4',
				en: 'My title 4'
			},
			slug: {
				fr: 'mon-titre-4',
				en: 'My-title-4'
			},
			category: {
				fr: ['cat-a'],
				en: ['cat-a']
			},
			postDate: new Date()
		};

		const id = await Post.create(createData);

		const post = await Post.findById(id);
		expect(post.id).to.eq(id);
		expect(post.title).to.eq(createData.title.fr);
		expect(post.slug).to.eq(createData.slug.fr);
		expect(post.category).to.eql(createData.category.fr);
		expect(post.postDate).to.eql(createData.postDate);

		expect(() => async () => {
			const trx = await Post.transaction();
			Post.create({
				title: {
					fr: 'Mon titre 4',
					en: 'My title 4'
				},
				slug: {
					fr: 'mon-titre-4',
					en: 'My-title-4'
				},
				category: {
					fr: ['cat-a'],
					en: ['cat-a']
				},
				postDate: new Date()
			}, trx);
		}).to.not.throw();
	});

	it('replace', async () => {
		const Post = new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema);
		const createData = {
			title: {
				fr: 'Mon titre 5',
				en: 'My title 5'
			},
			slug: {
				fr: 'mon-titre-5',
				en: 'My-title-5'
			},
			category: {
				fr: [],
				en: []
			},
			postDate: new Date()
		};
		const replaceData = {
			title: {
				fr: 'Mon titre 6',
				en: 'My title 6'
			},
			slug: {
				fr: 'mon-titre-6',
				en: 'My-title-6'
			}
		};

		const id = await Post.create(createData);

		await Post.replace({
			id,
			...createData,
			...replaceData
		});

		const post = await Post.findById(id);
		expect(post.title).to.eq(replaceData.title.fr);
		expect(post.slug).to.eq(replaceData.slug.fr);
		expect(post.category).to.eql(createData.category.fr);
		expect(post.postDate).to.eql(createData.postDate);

		expect(() => async () => {
			const trx = await Post.transaction();
			Post.replace({
				id,
				title: {
					fr: 'Mon titre 7',
					en: 'My title 7'
				},
				slug: {
					fr: 'mon-titre-7',
					en: 'My-title-7'
				},
				category: {
					fr: [],
					en: []
				},
				postDate: new Date()
			}, trx);
		}).to.not.throw();
	});

	it('delete', async () => {
		const Post = new Collection<PostFields, PostIndexes, PostInputs>(db, ['fr', 'en'], postSchema);

		const id = await Post.create({
			title: {
				fr: 'Mon titre 8',
				en: 'My title 8'
			},
			slug: {
				fr: 'mon-titre-8',
				en: 'My-title-8'
			},
			category: {
				fr: ['cat-a'],
				en: ['cat-a']
			},
			postDate: new Date()
		});

		await Post.delete(id);
	});

});