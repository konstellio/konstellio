export type Serializable = string | number | boolean | Date

export abstract class Driver {

	abstract set(key: string, value: Serializable, ttl: number): Promise<void>
	abstract get(key: string): Promise<Serializable>
	abstract has(key: string): Promise<boolean>
	abstract unset(key: string): Promise<void>

}