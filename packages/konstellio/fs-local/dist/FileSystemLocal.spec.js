"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
chai_1.use(require("chai-as-promised"));
chai_1.should();
const FileSystemLocal_1 = require("./FileSystemLocal");
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const FileSystem_spec_1 = require("@konstellio/fs/dist/FileSystem.spec");
describe('Local', () => {
    const tmp = fs_1.mkdtempSync(path_1.join(os_1.tmpdir(), 'konstellio-local-'));
    const fs = new FileSystemLocal_1.FileSystemLocal(tmp);
    before(() => {
        fs_1.mkdirSync(path_1.join(tmp, 'Griffin'));
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Peter.txt'), 'Peter Griffin');
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Stewie.txt'), 'Stewie Griffin');
    });
    FileSystem_spec_1.shouldBehaveLikeAFileSystem(fs);
});
//# sourceMappingURL=FileSystemLocal.spec.js.map