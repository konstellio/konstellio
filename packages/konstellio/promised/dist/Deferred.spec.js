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
const Deferred_1 = require("./Deferred");
describe('Deferred', () => {
    it('instanciate', () => {
        const d = new Deferred_1.Deferred();
        chai_1.expect(d.resolve).to.be.a('function');
        chai_1.expect(d.reject).to.be.a('function');
        chai_1.expect(d.promise).to.be.an.instanceof(Promise);
    });
    it('defer', () => __awaiter(this, void 0, void 0, function* () {
        const d = new Deferred_1.Deferred();
        let t = 0;
        setTimeout(() => d.resolve(10), 1000);
        chai_1.expect(t).to.eq(0);
        d.then(v => t = v);
        chai_1.expect(t).to.eq(0);
        yield d.promise;
        chai_1.expect(t).to.eq(10);
    }));
});
//# sourceMappingURL=Deferred.spec.js.map