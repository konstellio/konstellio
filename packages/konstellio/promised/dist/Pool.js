"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Deferred_1 = require("./Deferred");
class Pool {
    constructor(initialObjects) {
        this.disposed = false;
        this.waiters = [];
        this.pool = initialObjects ? initialObjects.concat() : [];
    }
    isDisposed() {
        return this.disposed;
    }
    dispose() {
        if (this.disposed === false) {
            this.disposed = true;
            for (const waiter of this.waiters) {
                waiter.reject();
            }
            this.waiters = [];
            this.pool = [];
        }
    }
    acquires() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.pool.length === 0) {
                const defer = new Deferred_1.Deferred();
                this.waiters.push(defer);
                return defer.promise;
            }
            return this.pool.shift();
        });
    }
    release(obj) {
        if (this.waiters.length === 0) {
            this.pool.push(obj);
        }
        else {
            const w = this.waiters.shift();
            w.resolve(obj);
        }
    }
}
exports.Pool = Pool;
//# sourceMappingURL=Pool.js.map