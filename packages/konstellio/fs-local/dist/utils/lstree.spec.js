"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
chai_1.use(require("chai-as-promised"));
chai_1.should();
const FileSystemLocal_1 = require("../FileSystemLocal");
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const fs_2 = require("@konstellio/fs");
describe('lstree', () => {
    const tmpA = fs_1.mkdtempSync(path_1.join(os_1.tmpdir(), 'konstellio-'));
    const fsA = new FileSystemLocal_1.FileSystemLocal(tmpA);
    before(() => {
        fs_1.mkdirSync(path_1.join(tmpA, 'Griffin'));
        fs_1.writeFileSync(path_1.join(tmpA, 'Griffin/Peter.txt'), 'Peter Griffin');
        fs_1.writeFileSync(path_1.join(tmpA, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
        fs_1.writeFileSync(path_1.join(tmpA, 'Griffin/Stewie.txt'), 'Stewie Griffin');
        fs_1.mkdirSync(path_1.join(tmpA, 'Griffin/SubFolder'));
        fs_1.writeFileSync(path_1.join(tmpA, 'Griffin/SubFolder/A.txt'), 'A');
        fs_1.writeFileSync(path_1.join(tmpA, 'Griffin/SubFolder/B.txt'), 'B');
        fs_1.writeFileSync(path_1.join(tmpA, 'Griffin/SubFolder/D.txt'), 'D');
    });
    it('list tree', () => __awaiter(this, void 0, void 0, function* () {
        var e_1, _a;
        const entries = [];
        try {
            for (var _b = __asyncValues(fs_2.lstree(fsA, '.')), _c; _c = yield _b.next(), !_c.done;) {
                const entry = _c.value;
                entries.push(entry);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) yield _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        chai_1.expect(entries[0][0]).to.equal('./Griffin');
        chai_1.expect(entries[0][1].isDirectory).to.equal(true);
        chai_1.expect(entries[0][1].size).to.equal(0);
        chai_1.expect(entries[1][0]).to.equal('./Griffin/Lois.txt');
        chai_1.expect(entries[1][1].isFile).to.equal(true);
        chai_1.expect(entries[1][1].size).to.equal(18);
        chai_1.expect(entries[2][0]).to.equal('./Griffin/Peter.txt');
        chai_1.expect(entries[2][1].isFile).to.equal(true);
        chai_1.expect(entries[2][1].size).to.equal(13);
        chai_1.expect(entries[3][0]).to.equal('./Griffin/Stewie.txt');
        chai_1.expect(entries[3][1].isFile).to.equal(true);
        chai_1.expect(entries[3][1].size).to.equal(14);
        chai_1.expect(entries[4][0]).to.equal('./Griffin/SubFolder');
        chai_1.expect(entries[4][1].isDirectory).to.equal(true);
        chai_1.expect(entries[4][1].size).to.equal(0);
        chai_1.expect(entries[5][0]).to.equal('./Griffin/SubFolder/A.txt');
        chai_1.expect(entries[5][1].isFile).to.equal(true);
        chai_1.expect(entries[5][1].size).to.equal(1);
        chai_1.expect(entries[6][0]).to.equal('./Griffin/SubFolder/B.txt');
        chai_1.expect(entries[6][1].isFile).to.equal(true);
        chai_1.expect(entries[6][1].size).to.equal(1);
        chai_1.expect(entries[7][0]).to.equal('./Griffin/SubFolder/D.txt');
        chai_1.expect(entries[7][1].isFile).to.equal(true);
        chai_1.expect(entries[7][1].size).to.equal(1);
    }));
});
//# sourceMappingURL=lstree.spec.js.map