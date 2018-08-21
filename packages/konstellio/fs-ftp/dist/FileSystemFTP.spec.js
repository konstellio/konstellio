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
const FileSystemFTP_1 = require("./FileSystemFTP");
const ftp_srv_1 = require("ftp-srv");
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const FileSystem_spec_1 = require("@konstellio/fs/dist/FileSystem.spec");
describe('FTP', () => {
    let ftpd;
    before(() => {
        const tmp = fs_1.mkdtempSync(path_1.join(os_1.tmpdir(), 'konstellio-ftp-'));
        fs_1.mkdirSync(path_1.join(tmp, 'Griffin'));
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Peter.txt'), 'Peter Griffin');
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Stewie.txt'), 'Stewie Griffin');
        ftpd = new ftp_srv_1.FtpSrv('ftp://127.0.0.1:2121');
        ftpd.log.level('fatal');
        ftpd.on('login', (_, resolve) => {
            resolve({ root: tmp, cwd: '/' });
        });
        return ftpd.listen();
    });
    const fsftp = new FileSystemFTP_1.FileSystemFTP({
        host: '127.0.0.1',
        port: 2121
    });
    FileSystem_spec_1.shouldBehaveLikeAFileSystem(fsftp);
    after(() => __awaiter(this, void 0, void 0, function* () {
        yield fsftp.disposeAsync();
        yield ftpd.close();
    }));
});
//# sourceMappingURL=FileSystemFTP.spec.js.map