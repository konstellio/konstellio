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
const Gate_1 = require("./Gate");
describe('Gate', () => {
    it('instanciate', () => {
        const g = new Gate_1.Gate();
        chai_1.expect(g.isOpened()).to.eq(false);
        g.open();
        chai_1.expect(g.isOpened()).to.eq(true);
        g.close();
        chai_1.expect(g.isOpened()).to.eq(false);
    });
    it('gate', () => __awaiter(this, void 0, void 0, function* () {
        const g = new Gate_1.Gate();
        let t = 0;
        setTimeout(() => g.open(), 1000);
        chai_1.expect(t).to.eq(0);
        yield g.wait();
        t += 1;
        chai_1.expect(t).to.eq(1);
        yield g.wait();
        t += 1;
        chai_1.expect(t).to.eq(2);
    }));
});
//# sourceMappingURL=Gate.spec.js.map