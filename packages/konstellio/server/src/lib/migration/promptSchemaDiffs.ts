import { ReadStream, WriteStream } from "tty";
import { SchemaDiff, compareTypes } from "./types";
import { promptSelection } from "../utilities/cli";
import { computeSchemaDiff } from "./computeSchemaDiff";

/**
 * Prompt user for migration diffs
 */
export async function promptSchemaDiffs(stdin: ReadStream, stdout: WriteStream, diffs: SchemaDiff[], compareTypes: compareTypes): Promise<SchemaDiff[]> {
	const actions: SchemaDiff[] = [];
	const renamedCollection: string[] = [];
	
	for (const diff of diffs) {
		if (diff.action === 'add_collection') {
			const tmpSchema = { collections: [{ handle: diff.collection.handle, fields: diff.collection.fields, indexes: [] }] };
			const similarCollections = diff.sourceSchema.collections.filter(collection => computeSchemaDiff(
				tmpSchema,
				{ collections: [{ handle: diff.collection.handle, fields: collection.fields, indexes: [] }] },
				compareTypes
			).length === 0);

			if (similarCollections.length > 0) {
				const choices = ([['$empty', `Leave \`${diff.collection.handle}\` empty`]] as [string, string][]).concat(
					similarCollections.map<[string, string]>(collection => ([collection.handle, `Copy content from \`${collection.handle}\``])),
					[['$abort', `Abort migration`]]
				);
				let choice: string;
				try {
					choice = await promptSelection(stdin, stdout, `Schema has a new collection \`${diff.collection.handle}\`, how do we initialize it?`, new Map(choices));
				} catch (err) {
					choice = '$abort';
				}

				if (choice === '$abort') {
					throw new Error(`User aborted migration.`);
				}
				else if (choice === '$empty') {
					actions.push(diff);
				}
				else {
					renamedCollection.push(choice);
					actions.push({
						action: 'rename_collection',
						collection: diff.collection,
						renamedFrom: choice
					});
				}
			} else {
				actions.push(diff);
			}
		}
		else if (diff.action === 'add_field') {
			const collection = diff.collection;
			const newField = diff.field;
			const sourceFieldsOfSameType = diff.sourceCollection.fields.filter(field => field.type === newField.type);
			if (sourceFieldsOfSameType.length > 0) {
				const sourceFieldsOfSameTypeNoLongerUsed = sourceFieldsOfSameType.filter(field => collection.fields.find(f => f.handle === field.handle) === undefined);
				const choices = ([['$empty', `Leave \`${collection.handle}\`.\`${newField.handle}\` empty`]] as [string, string][]).concat(
					sourceFieldsOfSameTypeNoLongerUsed.map<[string, string]>(field => ([field.handle, `Copy content from \`${collection.handle}\`.\`${field.handle}\``])),
					[['$abort', `Abort migration`]]
				);
				let choice: string;
				try {
					choice = await promptSelection(stdin, stdout, `Schema has a new field \`${collection.handle}\`.\`${newField.handle}\`, how do we initialize it?`, new Map(choices));
				} catch (err) {
					choice = '$abort';
				}

				if (choice === '$abort') {
					throw new Error(`User aborted migration.`);
				}
				else if (choice === '$empty') {
					actions.push(diff);
				}
				else {
					actions.push({
						...diff,
						renamedTo: choice
					});
				}
			} else {
				actions.push(diff);
			}
		}
		else if (diff.action === 'drop_field') {
			const collection = diff.collection;
			const dropField = diff.field;
			const choices: [string, string][] = [['$drop', `Drop \`${collection.handle}\`.\`${dropField.handle}\``], ['$abort', `Abort migration`]];
			let choice: string;
			try {
				choice = await promptSelection(stdin, stdout, `Field \`${collection.handle}\`.\`${dropField.handle}\` is no longer defined in schema, confirm deletion?`, new Map(choices));
			} catch (err) {
				choice = '$abort';
			}

			if (choice === '$abort') {
				throw new Error(`User aborted migration.`);
			}
			else {
				actions.push(diff);
			}
		}
		else if (diff.action === 'drop_collection') {
			const collection = diff.collection;
			if (!renamedCollection.includes(collection.handle)) {
				const choices: [string, string][] = [['$drop', `Drop \`${collection.handle}\``], ['$abort', `Abort migration`]];
				let choice: string;
				try {
					choice = await promptSelection(stdin, stdout, `Collection \`${collection.handle}\` is no longer defined in schema, confirm deletion?`, new Map(choices));
				} catch (err) {
					choice = '$abort';
				}

				if (choice === '$abort') {
					throw new Error(`User aborted migration.`);
				}
				else {
					actions.push(diff);
				}
			}
		}
		else {
			actions.push(diff);
		}
	}

	return actions;
}