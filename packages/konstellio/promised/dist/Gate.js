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
class Gate {
    constructor(closed = true) {
        this.closed = closed;
        this.waiters = [];
        this.disposed = false;
    }
    isDisposed() {
        return this.disposed;
    }
    dispose() {
        if (this.disposed === false) {
            this.disposed = true;
            this.waiters = [];
        }
    }
    isOpened() {
        return this.closed === false;
    }
    close() {
        this.closed = true;
    }
    open() {
        this.closed = false;
        for (const waiter of this.waiters) {
            waiter.resolve();
        }
        this.waiters = [];
    }
    wait() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.closed) {
                const waiter = new Deferred_1.Deferred();
                this.waiters.push(waiter);
                return waiter.promise;
            }
        });
    }
}
exports.Gate = Gate;
//# sourceMappingURL=Gate.js.map