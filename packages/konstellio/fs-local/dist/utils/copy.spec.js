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
const FileSystemLocal_1 = require("../FileSystemLocal");
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const fs_2 = require("@konstellio/fs");
describe('copy', () => {
    const tmpA = fs_1.mkdtempSync(path_1.join(os_1.tmpdir(), 'konstellio-copyA-'));
    const tmpB = fs_1.mkdtempSync(path_1.join(os_1.tmpdir(), 'konstellio-copyB-'));
    const fsA = new FileSystemLocal_1.FileSystemLocal(tmpA);
    const fsB = new FileSystemLocal_1.FileSystemLocal(tmpB);
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
    it('copy file', () => __awaiter(this, void 0, void 0, function* () {
        yield fs_2.copy(fsA, 'Griffin/Peter.txt', fsB, 'Peter.txt');
    }));
    it('copy directory', () => __awaiter(this, void 0, void 0, function* () {
        yield fs_2.copy(fsA, 'Griffin', fsB, 'Family-Guys');
    }));
});
//# sourceMappingURL=copy.spec.js.map