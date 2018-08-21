"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = require("@konstellio/cache");
const redis_1 = require("redis");
class CacheRedis extends cache_1.Cache {
    constructor(redis_url, options, clientFactory) {
        super();
        this.client = (clientFactory || redis_1.createClient)(redis_url, options);
        this.disposed = false;
    }
    isDisposed() {
        return this.disposed;
    }
    disposeAsync() {
        return this.disposed
            ? Promise.resolve()
            : new Promise((resolve, reject) => {
                this.client.quit((err) => {
                    if (err)
                        return reject(err);
                    resolve();
                });
            });
    }
    connect() {
        return Promise.resolve(this);
    }
    disconnect() {
        return this.disposeAsync();
    }
    set(key, value, ttl) {
        return new Promise((resolve, reject) => {
            this.client.set(key, value.toString(), 'EX', ttl, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
    expire(key, ttl) {
        return new Promise((resolve, reject) => {
            this.client.expire(key, ttl, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
    get(key) {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, reply) => {
                if (err) {
                    return reject(err);
                }
                resolve(reply);
            });
        });
    }
    has(key) {
        return new Promise((resolve, reject) => {
            this.client.exists(key, (err, reply) => {
                if (err) {
                    return reject(err);
                }
                resolve(reply === 1);
            });
        });
    }
    unset(key) {
        return new Promise((resolve, reject) => {
            this.client.del(key, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
}
exports.CacheRedis = CacheRedis;
//# sourceMappingURL=CacheRedis.js.map