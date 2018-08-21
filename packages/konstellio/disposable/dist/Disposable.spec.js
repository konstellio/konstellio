"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
const Disposable_1 = require("./Disposable");
describe('Disposable', () => {
    describe('Disposable', () => {
        it('constructor accept a function', () => {
            chai_1.expect(() => { new Disposable_1.Disposable(); }).to.throw(TypeError);
            chai_1.expect(() => { new Disposable_1.Disposable(() => true); }).to.not.throw(TypeError);
        });
        it('can be disposed', () => {
            let toDispose = 2;
            const disposable = new Disposable_1.Disposable(() => {
                toDispose -= 1;
            });
            chai_1.expect(disposable.isDisposed()).to.equal(false);
            chai_1.expect(() => { disposable.dispose(); }).to.not.throw(Error);
            chai_1.expect(toDispose).to.equal(1);
            chai_1.expect(disposable.isDisposed()).to.equal(true);
            disposable.dispose();
            chai_1.expect(toDispose).to.equal(1);
        });
    });
    describe('CompositeDisposable', () => {
        it('constructor accept a function', () => {
            chai_1.expect(() => { new Disposable_1.CompositeDisposable(); }).to.not.throw(TypeError);
            chai_1.expect(() => { new Disposable_1.CompositeDisposable([new Disposable_1.Disposable(() => true)]); }).to.not.throw(TypeError);
            chai_1.expect(() => { new Disposable_1.CompositeDisposable(new Set([new Disposable_1.Disposable(() => true)])); }).to.not.throw(TypeError);
        });
        it('can add Disposable', () => {
            let toDispose = 2;
            const composite = new Disposable_1.CompositeDisposable();
            composite.add(new Disposable_1.Disposable(() => { toDispose--; }));
            composite.add(new Disposable_1.Disposable(() => { toDispose--; }));
            composite.dispose();
            chai_1.expect(toDispose).to.equal(0);
        });
        it('can remove Disposable', () => {
            let toDispose = 2;
            const composite = new Disposable_1.CompositeDisposable();
            const disposable = new Disposable_1.Disposable(() => { toDispose--; });
            composite.add(new Disposable_1.Disposable(() => { toDispose--; }));
            composite.add(disposable);
            composite.remove(disposable);
            composite.dispose();
            chai_1.expect(toDispose).to.equal(1);
        });
        it('can be disposed', () => {
            let toDispose = 3;
            const composite = new Disposable_1.CompositeDisposable();
            const disposable = new Disposable_1.Disposable(() => { toDispose--; });
            composite.add(new Disposable_1.Disposable(() => { toDispose--; }));
            composite.add(new Disposable_1.Disposable(() => { toDispose--; }));
            disposable.dispose();
            chai_1.expect(composite.isDisposed()).to.equal(false);
            chai_1.expect(toDispose).to.equal(2);
            composite.dispose();
            chai_1.expect(composite.isDisposed()).to.equal(true);
            composite.dispose();
            chai_1.expect(toDispose).to.equal(0);
            composite.clear();
            composite.remove(disposable);
            chai_1.expect(toDispose).to.equal(0);
        });
        it('can clear all disposable', () => {
            let toDispose = 3;
            const composite = new Disposable_1.CompositeDisposable();
            const disposable = new Disposable_1.Disposable(() => { toDispose--; });
            composite.add(disposable);
            composite.clear();
            composite.dispose();
            chai_1.expect(toDispose).to.equal(3);
        });
    });
});
//# sourceMappingURL=Disposable.spec.js.map