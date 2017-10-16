import { Schema } from 'konstellio-schema';
import { Driver } from './Driver';

export class Document<T> {

	readonly driver: Driver;
	readonly schema: Schema;

	constructor(driver: Driver, schema: Schema) {
		this.schema = schema;
		this.driver = driver;
	}

	create(data?: any): T {
		return Object.assign({}, data) as T;
	}

	insert(doc: T): Promise<boolean> {
		return new Promise((resolve, reject) => {
			if (this.schema.validate(doc)) {

			}
		})
	}

}