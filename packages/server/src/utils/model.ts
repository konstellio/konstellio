import { Driver, q, Collection, Field as QueryField, Binary, FieldDirection, Function, Primitive, Comparison, QuerySelect, Query, ComparisonIn, BinaryExpression, Field } from "@konstellio/db";
import { Schema, Field as SchemaField } from "./schema";
import { PluginInitContext } from "./plugin";
import ObjectID from "bson-objectid"
import * as Dataloader from "dataloader";
import { isArray } from "util";

export async function getModels(context: PluginInitContext, schemas: Schema[], locales: string[]): Promise<Map<string, Model>> {
	const models = new Map<string, Model>();

	for (let i = 0, l = schemas.length; i < l; ++i) {
		const schema = schemas[i];
		if (schema.handle !== 'Relation') {
			models.set(schema.handle, new Model(context.database, schema, locales, models));
		}
	}

	return models;
}

export type ModelType = { [field: string]: undefined | Primitive | Primitive[] };
export type ModelInputType = { [field: string]: undefined | Primitive | Primitive[] | ({ [locale: string]: undefined | Primitive | Primitive[] }) };

export class Model<I extends ModelInputType = any, O extends ModelType = { id: string, [param: string]: any }> {
	
	private readonly collection: Collection;
	private readonly loader: Dataloader<string, O>;

	constructor(
		protected readonly database: Driver,
		protected readonly schema: Schema,
		protected readonly locales: string[],
		protected readonly models: Map<string, Model>
	) {
		this.collection = q.collection(schema.handle);

		// TODO Replace transform* from https://github.com/konstellio/konstellio/blob/e553f4421bd0dc6c361ff2f158d52116d21ea4fa/src/utils/model.ts#L209 to renameField
		// TODO Loader should "accumulate" required fields and only fetch those in the batch/bucket
		// TODO Loader from https://github.com/konstellio/konstellio/blob/2172e2e0203c1bd57cd041d31ccf6418eb23a8ed/src/utils/model.ts#L40
	}

	async findById(
		id: string,
		{ locale, fields }: { locale?: string, fields: (string | Field)[] }
	): Promise<O> {
		throw new Error(`Model.findById not implemented.`);
	}

	async findByIds(
		ids: string[],
		{ locale, fields }: { locale?: string, fields?: (string | Field)[] }
	): Promise<O> {
		throw new Error(`Model.findByIds not implemented.`);
	}

	async findOne(
		options: { locale?: string, fields?: (string | Field)[], condition?: BinaryExpression, sort?: FieldDirection[], offset?: number }
	): Promise<O> {
		const results = await this.find({
			...options,
			limit: 1
		});
		if (results.length === 0) {
			throw new Error(`Could not find anything matching query in ${this.schema.handle}.`);
		}
		return results[0];
	}

	async find(
		{ locale, fields, condition, sort, offset, limit }: { locale?: string, fields?: (string | Field)[], condition?: BinaryExpression, sort?: FieldDirection[], offset?: number, limit?: number }
	): Promise<O[]> {
		throw new Error(`Model.find not implemented.`);
	}

	async aggregate(
		{ locale, fields, condition, group, sort, offset, limit }: { locale?: string, fields?: (string | Field | Function)[], condition?: BinaryExpression, group?: (string | Field)[], sort?: FieldDirection[], offset?: number, limit?: number }
	): Promise<O[]> {
		throw new Error(`Model.aggregate not implemented.`);
	}

	async create(
		data: I
	): Promise<O> {
		throw new Error(`Model.create not implemented.`);
	}

	async replace(
		data: I
	): Promise<string> {
		throw new Error(`Model.replace not implemented.`);
	}

	async delete(
		ids: string[]
	): Promise<boolean> {
		const result = await this.database.execute(q.delete(this.collection).where(q.in('id', ids)));
		if (result.acknowledge) {
			await this.database.execute(q.delete('Relation').where(q.in('source', ids)));
			ids.forEach(id => this.loader.clear(id));
			return true;
		}
		return false;
	}

	validate(data: any, errors: Error[] = []): data is I {
		if (typeof data !== 'object') {
			errors.push(new Error(`Expected data to be an object.`));
			return false;
		}

		const fields = this.schema.fields;
		for (let i = 0, l = fields.length; i < l; ++i) {
			const field = fields[i];
			if (field.handle !== 'id') {
				const value = data[field.handle];

				this.validateField(value, field, errors);
				// if (this.validateField(value, field, errors) === false) {
				// 	return false;
				// }
			}
		}
		return errors.length === 0;
		// return true;
	}

	private validateField(value: any, field: SchemaField, errors: Error[], locale = false): boolean {
		// Localized
		if (field.localized === true && locale === false) {
			if (typeof value !== 'object') {
				errors.push(new Error(`Expected ${field.handle} to be an object.`));
				return false;
			}
			return this.locales.reduce((valid, locale) => {
				if (typeof value[locale] === 'undefined') {
					errors.push(new Error(`Expected ${field.handle}.${locale} to be defined.`));
					return false;
				}
				return valid && this.validateField(value[locale], field, errors, true);
			}, true);
		}

		// Required
		if (field.required === true && !value) {
			errors.push(new Error(`Expected ${field.handle} to be non-null.`));
			return false;
		}

		// Undefined / Null, but not required
		else if (value === undefined || value === null) {
			return true;
		}

		// Relation !== string[]
		if (field.type === 'relation' && (!isArray(value) || value.find(v => typeof v !== 'string') !== undefined)) {
			errors.push(new Error(`Expected ${field.handle} to be an array of string.`));
			return false;
		}
		// Text, Html !== string
		else if ((field.type === 'text' || field.type === 'html') && typeof value !== 'string') {
			errors.push(new Error(`Expected ${field.handle} to be a string.`));
			return false;
		}
		// Date, DateTime !== Date
		else if ((field.type === 'date' || field.type === 'datetime') && (value instanceof Date) === false) {
			errors.push(new Error(`Expected ${field.handle} to be an instance of Date.`));
			return false;
		}
		// Int, Float is a Number
		else if ((field.type === 'int' || field.type === 'float') && isNaN(value) === true) {
			errors.push(new Error(`Expected ${field.handle} to be a number.`));
			return false;
		}
		// Bool is a boolean
		else if ((field.type === 'bool' || field.type === 'boolean') && typeof value !== 'boolean') {
			errors.push(new Error(`Expected ${field.handle} to be a boolean.`));
			return false;
		}

		return true;
	}

}