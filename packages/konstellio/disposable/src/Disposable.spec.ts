import 'mocha';
import { expect } from 'chai';
import { Disposable, CompositeDisposable } from './Disposable';

describe('Disposable', () => {

	describe('Disposable', () => {

		it('constructor accept a function', () => {
			expect(() => { new Disposable(); }).to.throw(TypeError);
			expect(() => { new Disposable(() => true); }).to.not.throw(TypeError);
		});

		it('can be disposed', () => {
			let toDispose = 2;
			const disposable = new Disposable(() => {
				toDispose -= 1;
			});
			expect(disposable.isDisposed()).to.equal(false);
			expect(() => { disposable.dispose(); }).to.not.throw(Error);
			expect(toDispose).to.equal(1);
			expect(disposable.isDisposed()).to.equal(true);
			disposable.dispose();
			expect(toDispose).to.equal(1);
		});

	});

	describe('CompositeDisposable', () => {

		it('constructor accept a function', () => {
			expect(() => { new CompositeDisposable(); }).to.not.throw(TypeError);
			expect(() => { new CompositeDisposable([new Disposable(() => true)]); }).to.not.throw(TypeError);
			expect(() => { new CompositeDisposable(new Set([new Disposable(() => true)])); }).to.not.throw(TypeError);
		});

		it('can add Disposable', () => {
			let toDispose = 2;
			const composite = new CompositeDisposable();
			composite.add(new Disposable(() => { toDispose--; }));
			composite.add(new Disposable(() => { toDispose--; }));
			composite.dispose();
			expect(toDispose).to.equal(0);
		});

		it('can remove Disposable', () => {
			let toDispose = 2;
			const composite = new CompositeDisposable();
			const disposable = new Disposable(() => { toDispose--; });
			composite.add(new Disposable(() => { toDispose--; }));
			composite.add(disposable);
			composite.remove(disposable);
			composite.dispose();
			expect(toDispose).to.equal(1);
		});

		it('can be disposed', () => {
			let toDispose = 3;
			const composite = new CompositeDisposable();
			const disposable = new Disposable(() => { toDispose--; });
			composite.add(new Disposable(() => { toDispose--; }));
			composite.add(new Disposable(() => { toDispose--; }));

			disposable.dispose();
			expect(composite.isDisposed()).to.equal(false);
			expect(toDispose).to.equal(2);
			composite.dispose();
			expect(composite.isDisposed()).to.equal(true);
			composite.dispose();
			expect(toDispose).to.equal(0);
			composite.clear();
			composite.remove(disposable);
			expect(toDispose).to.equal(0);
		});

		it('can clear all disposable', () => {
			let toDispose = 3;
			const composite = new CompositeDisposable();
			const disposable = new Disposable(() => { toDispose--; });
			composite.add(disposable);
			composite.clear();
			composite.dispose();
			expect(toDispose).to.equal(3);
		});

	});

});