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
const CacheRedis_1 = require("./CacheRedis");
describe('Redis', () => {
    const cache = new CacheRedis_1.CacheRedis('redis://10.0.75.1');
    before(done => {
        cache.connect().then(() => done());
    });
    after(done => {
        cache.disconnect().then(() => done()).catch(done);
    });
    it('test', () => __awaiter(this, void 0, void 0, function* () {
        console.log(yield cache.has('test'));
        yield cache.set('test', 'Bleh', 600);
        console.log(yield cache.has('test'));
        console.log(yield cache.get('test'));
        yield cache.unset('test');
        console.log(yield cache.has('test'));
    }));
});
//# sourceMappingURL=CacheRedis.spec.js.map