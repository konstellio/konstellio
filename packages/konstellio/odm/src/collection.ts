import { EventEmitter } from '@konstellio/eventemitter';
import { Database, q, Collection as DBCollection, Field, FieldAs, FieldDirection, BinaryExpression, Function, Transaction, QueryDelete, replaceField, Comparison } from '@konstellio/db';
import * as assert from 'assert';
import * as Dataloader from "dataloader";
import * as Joi from 'joi';
import { Schema, Field as SchemaField, validateSchema, createValidator, isUnion } from './schema';
import { KnownDirectivesRule, assertType } from 'graphql';
import { isArray } from 'util';
import uuid = require('uuid');

const relationCollection = q.collection('Relation');
const selectRelationQuery = q.select('field', 'source', 'target').from(relationCollection).sort(q.sort('seq', 'asc')).where(q.and(
	q.eq(q.field('collection'), q.var('collection')),
	q.in(q.field('source'), q.var('sources')),
	q.in(q.field('field'), q.var('fields'))
));
const createRelationQuery = q.insert(relationCollection).add({
	id: q.var('id'),
	collection: q.var('collection'),
	field: q.var('field'),
	source: q.var('source'),
	target: q.var('target'),
	seq: q.var('seq')
});
const deleteRelationQuery = q.delete(relationCollection).where(q.in('source', q.var('sources')));

export interface OptionFindById {
	locale?: string;
}
export interface OptionFindByIdSelect<Columns> {
	locale?: string;
	fields?: Columns[];
}
export interface OptionFindOne<Indexes> {
	locale?: string;
	condition?: BinaryExpression<Indexes>;
	sort?: FieldDirection<Indexes>[];
	offset?: number;
}
export interface OptionFindOneSelect<Columns, Indexes> {
	locale?: string;
	fields?: Columns[];
	condition?: BinaryExpression<Indexes>;
	sort?: FieldDirection<Indexes>[];
	offset?: number;
}
export interface OptionFindMany<Indexes> {
	locale?: string;
	condition?: BinaryExpression<Indexes>;
	sort?: FieldDirection<Indexes>[];
	offset?: number;
	limit?: number;
}
export interface OptionFindManySelect<Columns, Indexes> {
	locale?: string;
	fields?: Columns[];
	condition?: BinaryExpression<Indexes>;
	sort?: FieldDirection<Indexes>[];
	offset?: number;
	limit?: number;
}
export interface OptionAggregate<Indexes> {
	locale?: string;
	condition?: BinaryExpression<Indexes>;
	group?: (Field<Indexes> | Function<Indexes>)[];
	sort?: FieldDirection<Indexes>[];
	offset?: number;
	limit?: number;
}
export interface OptionAggregateSelect<Columns, Indexes> {
	locale?: string;
	fields?: Columns[];
	condition?: BinaryExpression<Indexes>;
	group?: (Field<Indexes> | Function<Indexes>)[];
	sort?: FieldDirection<Indexes>[];
	offset?: number;
	limit?: number;
}

interface LoaderInput<Columns> {
	id: string;
	locale?: string;
	fields?: Columns[];
}

interface FlatInput {
	fields: { [key: string]: any };
	relations: { [key: string]: string[] };
}

export class Collection<
	Columns extends { id: string } = any,
	Indexes extends { id: string } = any,
	Inputs extends { id?: string } = any
> extends EventEmitter {

	protected readonly deleteQuery: QueryDelete;
	protected readonly validator: Joi.Schema;
	protected readonly localizedFieldMap: Map<string, Map<Field, Field>>;
	protected readonly loader: Dataloader<LoaderInput<keyof Columns>, Partial<Columns> | undefined>;
	
	protected readonly collection: DBCollection;
	protected readonly schema: Schema;
	protected readonly schemaFields: SchemaField[];
	protected readonly fieldTransforms: (row: any) => any;

	constructor(
		protected readonly database: Database,
		protected readonly locales: string[],
		schema: Schema,
		protected readonly mandatoryFields: string[] = []
	) {
		super();
		
		assert(validateSchema(schema), `Parameter \`schema\` is not a valid Schema.`);

		this.schema = schema;
		this.schemaFields = isUnion(this.schema)
			? this.schema.objects.reduce((fields, obj) => { return [...fields, ...obj.fields]; }, [] as SchemaField[])
			: this.schema.fields;
		this.fieldTransforms = this.schemaFields.reduce((prev, def) => {
			if (def.inlined) {
				return (row: any) => { row[def.handle] = JSON.parse(row[def.handle]); return prev(row); };
			}
			else if (def.type === 'int') {
				return (row: any) => { row[def.handle] = parseInt(row[def.handle], 10) || 0; return prev(row); };
			}
			else if (def.type === 'float') {
				return (row: any) => { row[def.handle] = parseFloat(row[def.handle]) || 0; return prev(row); };
			}
			else if (def.type === 'boolean') {
				return (row: any) => { row[def.handle] = !!row[def.handle]; return prev(row); };
			}
			else if (def.type === 'date' || def.type === 'datetime') {
				return (row: any) => { row[def.handle] = new Date(row[def.handle]); return prev(row); };
			}
			return prev;
		}, (row: any) => row);
		this.collection = q.collection(this.schema.handle);
		this.deleteQuery = q.delete(this.collection).where(q.eq('id', q.var('id')));
		this.validator = createValidator(this.schema, locales);

		// Build a map of each locale renamed localized fields { en: { title: title__en, ... }, fr: { ... } }
		this.localizedFieldMap = new Map(locales.map(locale => [
			locale,
			new Map(this.schemaFields.reduce((map, def) => {
				const field = q.field(def.handle);
				if (this.database.features.join && (def.relation || def.multiple)) {
					map.push([field, q.field('target', `ref__${def.handle}${def.localized ? `__${locale}` : ''}`)]);
				} else {
					map.push([field, q.field(def.localized ? `${def.handle}__${locale}` : def.handle)]);
				}
				return map;
			}, [] as [Field, Field][]))
		]) as [string, Map<Field, Field>][]);
		if (this.locales.length === 0) {
			this.localizedFieldMap.set('', new Map(this.schemaFields.reduce((map, def) => {
				const field = q.field(def.handle);
				if (this.database.features.join && (def.relation || def.multiple)) {
					map.push([field, q.field('target', `ref__${def.handle}`)]);
				} else {
					map.push([field, q.field(def.handle)]);
				}
				return map;
			}, [] as [Field, Field][])));
		}

		// Setup loader to minimize database bandwidth
		this.loader = new Dataloader(
			async (keys) => {
				if (this.locales.length === 0) {
					const ids = keys.map(key => key.id);
					const uids = ids.filter((id, pos, ids) => ids.indexOf(id) === pos);
					const fields = keys.reduce((fields, key) => [...fields, ...key.fields || []], [] as any[]);
					const ufields = fields.filter((field, pos, fields) => fields.indexOf(field) === pos);

					const results = await this.findMany({
						fields: ufields,
						condition: q.in('id', uids)
					});

					return ids.map<any>(id => {
						const res = results.filter((result: any) => result.id === id);
						return res.length === 1 ? res[0] : undefined;
					});
				} else {
					const batched = keys.reduce((batched, key) => {
						const locale = key.locale || this.locales[0];

						batched[locale] = batched[locale] || { fields: [], ids: [] };
						batched[locale].ids.push(key.id);
						batched[locale].fields.push(...(key.fields || []));

						return batched;
					}, {} as { [locale: string]: { fields: any[], ids: string[] } });

					const localeResults = await Promise.all(Object.keys(batched).reduce((promises, locale) => {
						const { fields, ids } = batched[locale];
						return [...promises, this.findMany({ locale, fields, condition: q.in('id', ids) })];
					}, [] as Promise<any>[]));

					return keys.map<any>(key => {
						const locale = key.locale || this.locales[0];
						const localeIdx = this.locales.indexOf(locale);
						const results = localeResults[localeIdx];
						return results.find((row: any) => row.id === key.id);
					});
				}
			},
			{
				// cache: true,
				cacheKeyFn(key: LoaderInput<Columns>) {
					return `${key.id}=${key.locale}`;
				}
			}
		);
	}

	generateId(): string {
		return uuid();
	}

	async transaction(): Promise<Transaction> {
		return this.database.transaction();
	}

	async findById(id: string, options?: OptionFindById): Promise<Columns>;
	async findById<K extends keyof Columns>(id: string, options?: OptionFindByIdSelect<K>): Promise<Pick<Columns, K>>;
	async findById<K extends keyof Columns>(id: string, options: OptionFindById | OptionFindByIdSelect<K> = {}): Promise<Columns | Pick<Columns, K>> {
		const results = await this.findByIds([id], options);
		if (results.length === 0) {
			throw new Error(`Could not find ID ${id} in collection \`${this.schema.handle}\`.`);
		}
		return results[0];
	}

	async findByIds(ids: string[], options?: OptionFindById): Promise<Columns[]>;
	async findByIds<K extends keyof Columns>(ids: string[], options?: OptionFindByIdSelect<K>): Promise<Pick<Columns, K>[]>;
	async findByIds<K extends keyof Columns>(ids: string[], options: OptionFindById | OptionFindByIdSelect<K> = {}): Promise<Columns[] | Pick<Columns, K>[]> {
		try {
			const results = await this.loader.loadMany(ids.map(id => ({
				id,
				locale: options && options.locale,
				fields: options && (options as OptionFindByIdSelect<K>).fields
			})));
			const realResults = results.filter((result): result is Partial<Columns> => result !== undefined);
			if (realResults.length === ids.length) {
				return realResults as Columns[];
			}
		} catch (err) { }
		throw new Error(`Could not find IDs ${ids.join(', ')} in collection \`${this.schema.handle}\`.`);
	}

	async findOne(options?: OptionFindOne<Indexes>): Promise<Columns>;
	async findOne<K extends keyof Columns>(options?: OptionFindOneSelect<K, Indexes>): Promise<Pick<Columns, K>>;
	async findOne<K extends keyof Columns>(options: OptionFindOne<Indexes> | OptionFindOneSelect<K, Indexes> = {}): Promise<Columns | Pick<Columns, K>> {
		const results = await this.findMany({ ...options, limit: 1 });
		if (results.length === 0) {
			throw new Error(`Could not find anything matching query in collection \`${this.schema.handle}\`.`);
		}
		return results[0];
	}

	async findMany(options?: OptionFindMany<Indexes>): Promise<Columns[]>;
	async findMany<K extends keyof Columns>(options?: OptionFindManySelect<K, Indexes>): Promise<Pick<Columns, K>[]>;
	async findMany<K extends keyof Columns>(options?: OptionFindMany<Indexes> | OptionFindManySelect<K, Indexes>): Promise<Columns[] | Pick<Columns, K>[]> {
		return this.aggregate(options);
	}

	async aggregate(options?: OptionAggregate<Indexes>): Promise<Columns[]>;
	async aggregate<K extends keyof Columns>(options?: OptionAggregateSelect<K, Indexes>): Promise<Pick<Columns, K>[]>;
	async aggregate<K extends keyof Columns>(options: OptionAggregate<Indexes> | OptionAggregateSelect<K, Indexes> = {}): Promise<Columns[] | Pick<Columns, K>[]> {
		const locale = this.locales.length ? (options.locale || this.locales[0]) : undefined;
		const fieldMap = this.localizedFieldMap.get(locale || '');

		if (!fieldMap) {
			throw new Error(`Collection \`${this.schema.handle}\` doe not have locale ${locale}.`);
		}

		const featuresJoin = this.database.features.join;
		const fields: string[] = (options as OptionAggregateSelect<K, Indexes>).fields as (string[] | undefined) || [];

		if (fields.length === 0) {
			fields.push(...this.schemaFields.map(field => field.handle));
		}

		fields.push(...this.mandatoryFields);

		const fieldUsed: Field[] = [];
		const relationalFields: string[] = [];
		const nonRelationalFields: string[] = [];

		for (const handle of fields) {
			const def = this.schemaFields.find(field => field.handle === handle);
			if (!def) {
				throw new Error(`Unknown field \`${handle}\` of ${this.schema.handle}.`);
			}
			if (featuresJoin && (def.relation || def.multiple)) {
				!relationalFields.includes(handle) && relationalFields.push(handle);
			} else {
				!nonRelationalFields.includes(handle) && nonRelationalFields.push(handle);
			}
		}

		const selectFields = relationalFields.length && !nonRelationalFields.includes('id') ? nonRelationalFields.concat(['id']) : nonRelationalFields;
		const localizedSelect = replaceField(
			selectFields.map(handle => q.as(handle, handle)),
			fieldMap,
			fieldUsed
		);

		let query = q.aggregate(...localizedSelect);
		query = query.from(this.collection);
		query = query.range({ limit: options.limit, offset: options.offset });

		if (options.condition) {
			const localizedCondition = replaceField(
				options.condition instanceof Comparison ? q.and(options.condition) : options.condition,
				fieldMap,
				fieldUsed
			);
			query = query.where(localizedCondition);
		}

		if (options.group) {
			const localizedGroup = replaceField(options.group, fieldMap, fieldUsed);
			query = query.group(localizedGroup);
		}

		if (options.sort) {
			const localizedSort = replaceField(options.sort, fieldMap, fieldUsed);
			query = query.group(localizedSort);
		}

		if (featuresJoin) {
			for (const def of this.schemaFields) {
				if (def.relation || def.multiple) {
					const used = fieldUsed.find(field => field.name === def.handle);
					if (used) {
						const localizedHandle = replaceField(def.handle, fieldMap);
						const alias = `ref__${localizedHandle}`;
						query = query.join(
							alias,
							q
								.select('collection', 'field', 'source', 'target', 'seq')
								.from(relationCollection)
								.where(q.and(
									q.eq('collection', this.schema.handle),
									q.eq('field', localizedHandle)
								)),
							q.eq(
								q.field('source', alias),
								q.field('id')
							)
						);
					}
				}
			}
		}

		const result = await this.database.execute<Partial<Columns>>(query);

		if (featuresJoin && relationalFields.length) {
			const sources: string[] = result.results.map(({ id }: any) => id);
			const relationFieldMap: Map<string, SchemaField> = new Map(this.schemaFields.reduce((map, def) => {
				if (relationalFields.includes(def.handle)) {
					map.push([locale && def.localized ? `${def.handle}__${locale}` : def.handle, def]);
				}
				return map;
			}, [] as [string, SchemaField][]));
			const relResult = await this.database.execute<{ field: string, source: string, target: string }>(selectRelationQuery, { sources, fields: Array.from(relationFieldMap.keys()), collection: this.schema.handle });
			for (const row of result.results) {
				for (const rel of relResult.results) {
					if (rel.source === row.id) {
						const field = relationFieldMap.get(rel.field)!;
						if (field.multiple) {
							(row as any)[field.handle] = (row as any)[field.handle] || [];
							(row as any)[field.handle].push(rel.target);
						} else {
							(row as any)[field.handle] = rel.target;
						}
					}
				}
			}
		}

		return result.results.map<any>(row => this.fieldTransforms(row));
	}

	protected flattenLocalizedFields(data: any): FlatInput {
		const featuresJoin = this.database.features.join;
		return this.schemaFields.reduce((flatten, def) => {
			if (def.localized) {
				for (const locale of this.locales) {
					if (def.inlined) {
						data[def.handle][locale] = JSON.stringify(data[def.handle][locale]);
					}
					const handle = `${def.handle}__${locale}`;
					if (featuresJoin && (def.relation || def.multiple)) {
						flatten.relations[handle] = isArray(data[def.handle][locale]) ? data[def.handle][locale] : [data[def.handle][locale]];
					} else {
						flatten.fields[handle] = data[def.handle][locale];
					}
				}
			} else {
				if (def.inlined) {
					data[def.handle] = JSON.stringify(data[def.handle]);
				}
				if (featuresJoin && (def.relation || def.multiple)) {
					flatten.relations[def.handle] = isArray(data[def.handle]) ? data[def.handle] : [data[def.handle]];
				} else {
					flatten.fields[def.handle] = data[def.handle];
				}
			}
			return flatten;
		}, { fields: {}, relations: {} } as FlatInput);
	}

	protected addRelationToTransaction(transaction: Transaction, id: string, relations: { [key: string]: string[] }) {
		const createRelation = (handle: string, target: string, seq: number) => {
			transaction.execute(createRelationQuery, {
				target,
				seq,
				collection: this.schema.handle,
				field: handle,
				id: uuid(),
				source: id
			});
		};
		for (const def of this.schemaFields) {
			if (def.relation || def.multiple) {
				if (def.localized) {
					for (const locale of this.locales) {
						const handle = `${def.handle}__${locale}`;
						let seq = 0;
						if (relations[handle]) {
							for (const target of relations[handle]) {
								createRelation(handle, target, seq++);
							}
						}
					}
				} else {
					let seq = 0;
					if (relations[def.handle]) {
						for (const target of relations[def.handle]) {
							createRelation(def.handle, target, seq++);
						}
					}
				}
			}
		}
	}

	create(data: Inputs): Promise<string>;
	create(data: Inputs, transaction: Transaction): void;
	create(data: Inputs, transaction?: Transaction): Promise<string> | void {
		data.id = data.id || uuid();
		
		const featuresJoin = this.database.features.join;
		const executeCreate = (transaction: Transaction, data: any) => {
			assert(this.validate(data), `Provided data is not valid for ${this.schema.handle}.`);

			const { id, ...rest } = data as any;
			const { fields, relations } = this.flattenLocalizedFields(rest);
			delete fields.id;

			transaction.execute(q.insert(this.collection).add({ id, ...fields }));
			if (featuresJoin) {
				this.addRelationToTransaction(transaction, id!, relations);
			}
		};

		if (transaction) {
			executeCreate(transaction, data);
			return;
		} else {
			return new Promise<any>(async (resolve) => {
				const transaction = await this.database.transaction();
				executeCreate(transaction, data);
				await transaction.commit();
				resolve(data.id!);
			});
		}
	}

	replace(data: Inputs): Promise<void>;
	replace(data: Inputs, transaction: Transaction): void;
	replace(data: Inputs, transaction?: Transaction): Promise<void> | void {
		const featuresJoin = this.database.features.join;
		const executeCreate = (transaction: Transaction, data: any) => {
			assert(data.id, `Provided data needs an ID.`);
			assert(this.validate(data), `Provided data is not valid for ${this.schema.handle}.`);

			const { id, ...rest } = data as any;
			const { fields, relations } = this.flattenLocalizedFields(rest);
			delete fields.id;

			transaction.execute(deleteRelationQuery, { sources: [id] });
			transaction.execute(q.update(this.collection).set(fields).where(q.eq('id', id)));
			if (featuresJoin) {
				this.addRelationToTransaction(transaction, id!, relations);
			}
		};

		if (transaction) {
			executeCreate(transaction, data);
			return;
		} else {
			return new Promise<any>(async (resolve) => {
				const transaction = await this.database.transaction();
				executeCreate(transaction, data);
				await transaction.commit();
				resolve();
			});
		}
	}

	delete(id: string): Promise<void>;
	delete(id: string, transaction: Transaction): void;
	delete(id: string, transaction?: Transaction): Promise<void> | void {
		if (transaction) {
			transaction.execute(this.deleteQuery, { id });
			return;
		} else {
			return new Promise(async resolve => {
				const transaction = await this.database.transaction();
				transaction.execute(this.deleteQuery, { id });
				await transaction.commit();
				resolve();
			});
		}
	}

	validate(data: any, errors: Joi.ValidationErrorItem[] = []): data is Inputs {
		const result = this.validator.validate(data);
		if (result.error) {
			errors.push(...result.error.details);
			return true;
		}
		return false;
	}

}