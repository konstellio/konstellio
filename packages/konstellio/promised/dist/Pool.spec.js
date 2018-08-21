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
require("mocha");
const chai_1 = require("chai");
chai_1.use(require("chai-as-promised"));
chai_1.should();
const Pool_1 = require("./Pool");
describe('Pool', () => {
    it('instanciate', () => __awaiter(this, void 0, void 0, function* () {
        const a = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
        const b = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
        const c = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
        const g = new Pool_1.Pool([a, b, c]);
        let t = yield g.acquires();
        chai_1.expect(t).to.eq(a);
        t.inc();
        g.release(t);
        chai_1.expect(a.count).to.eq(1);
        chai_1.expect(b.count).to.eq(0);
        chai_1.expect(c.count).to.eq(0);
        t = yield g.acquires();
        chai_1.expect(t).to.eq(b);
    }));
    it('defer', () => __awaiter(this, void 0, void 0, function* () {
        const a = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
        // const b = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
        // const c = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
        const g = new Pool_1.Pool();
        setTimeout(() => g.release(a), 1000);
        let t = yield g.acquires();
        chai_1.expect(t).to.eq(a);
    }));
});
//# sourceMappingURL=Pool.spec.js.map