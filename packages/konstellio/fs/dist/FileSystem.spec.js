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
const FileSystem_1 = require("./FileSystem");
require("mocha");
const chai_1 = require("chai");
chai_1.use(require("chai-as-promised"));
chai_1.should();
const stream_1 = require("stream");
const Errors_1 = require("./Errors");
function shouldBehaveLikeAFileSystem(fs) {
    it('can stat a directory', () => __awaiter(this, void 0, void 0, function* () {
        const stats = yield fs.stat('Griffin');
        chai_1.expect(stats).to.be.an.instanceof(FileSystem_1.Stats);
    }));
    it('can read a directory', () => __awaiter(this, void 0, void 0, function* () {
        const children = yield fs.readDirectory('Griffin');
        chai_1.expect(children).to.deep.equal([
            'Lois.txt',
            'Peter.txt',
            'Stewie.txt'
        ]);
    })).timeout(10000);
    it('can stat a file', () => __awaiter(this, void 0, void 0, function* () {
        const stats = yield fs.stat('Griffin/Peter.txt');
        chai_1.expect(stats).to.be.an.instanceof(FileSystem_1.Stats);
    }));
    it('can read file', () => __awaiter(this, void 0, void 0, function* () {
        const stream = yield fs.createReadStream('Griffin/Peter.txt');
        chai_1.expect(stream).to.be.an.instanceof(stream_1.Readable);
        const data = yield new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('error', err => reject(err));
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('close', () => resolve(Buffer.concat(chunks)));
        });
        chai_1.expect(data).to.be.an.instanceOf(Buffer);
        chai_1.expect(data.toString('utf8')).to.equal('Peter Griffin');
    })).timeout(10000);
    it('can write file', () => __awaiter(this, void 0, void 0, function* () {
        const writeStream = yield fs.createWriteStream('Griffin/Christ.txt');
        chai_1.expect(writeStream).to.be.an.instanceof(stream_1.Writable);
        yield new Promise((resolve) => {
            writeStream.end(Buffer.from('Christ Griffin'), 'utf8', () => {
                return resolve();
            });
        });
        const readStream = yield fs.createReadStream('Griffin/Christ.txt');
        chai_1.expect(readStream).to.be.an.instanceof(stream_1.Readable);
        const data = yield new Promise((resolve, reject) => {
            const chunks = [];
            readStream.on('error', err => reject(err));
            readStream.on('data', chunk => chunks.push(chunk));
            readStream.on('close', () => resolve(Buffer.concat(chunks)));
        });
        chai_1.expect(data).to.be.an.instanceOf(Buffer);
        chai_1.expect(data.toString('utf8')).to.equal('Christ Griffin');
    })).timeout(10000);
    it('can rename file', () => __awaiter(this, void 0, void 0, function* () {
        yield fs.rename('Griffin/Peter.txt', 'Griffin/Peter2.txt');
        const exists = yield fs.exists('Griffin/Peter.txt');
        chai_1.expect(exists).to.equal(false);
    }));
    it('can copy file', () => __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs.copy('Griffin/Lois.txt', 'Griffin/Lois2.txt');
            const exists = yield fs.exists('Griffin/Lois.txt');
            chai_1.expect(exists).to.equal(true);
        }
        catch (err) {
            chai_1.expect(err).to.be.an.instanceof(Errors_1.OperationNotSupported);
        }
    }));
}
exports.shouldBehaveLikeAFileSystem = shouldBehaveLikeAFileSystem;
//# sourceMappingURL=FileSystem.spec.js.map