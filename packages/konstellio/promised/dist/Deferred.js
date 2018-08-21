"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
        this.disposed = false;
    }
    isDisposed() {
        return this.disposed;
    }
    dispose() {
        if (this.disposed === false) {
            this.disposed = true;
            this.promise = undefined;
        }
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Deferred.
     * @param onfulfilled The callback to execute when the Deferred is resolved.
     * @param onrejected The callback to execute when the Deferred is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        return this.promise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Deferred.
     * @param onrejected The callback to execute when the Deferred is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        return this.promise.catch(onrejected);
    }
}
exports.Deferred = Deferred;
//# sourceMappingURL=Deferred.js.map