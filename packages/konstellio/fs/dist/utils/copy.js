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
const path_1 = require("path");
const lstree_1 = require("./lstree");
function copy(fsSource, source, fsDestination, destination) {
    return __awaiter(this, void 0, void 0, function* () {
        var e_1, _a;
        const stat = yield fsSource.stat(source);
        if (stat.isFile) {
            // TODO: Progression
            const readStream = yield fsSource.createReadStream(source);
            const writeStream = yield fsDestination.createWriteStream(destination);
            yield new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
                readStream.pipe(writeStream);
            });
        }
        else {
            let first = true;
            try {
                for (var _b = __asyncValues(lstree_1.lstree(fsSource, source)), _c; _c = yield _b.next(), !_c.done;) {
                    const [path, stat] = _c.value;
                    if (first) {
                        first = false;
                        yield fsDestination.createDirectory(path_1.dirname(path), true);
                    }
                    if (stat.isFile) {
                        yield copy(fsSource, path, fsDestination, path);
                    }
                    else if (stat.isDirectory) {
                        yield fsDestination.createDirectory(path, true);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) yield _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    });
}
exports.copy = copy;
//# sourceMappingURL=copy.js.map