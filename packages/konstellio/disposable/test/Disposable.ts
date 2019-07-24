import 'mocha';
import { expect } from 'chai';
import { Disposable, CompositeDisposable } from '../src/Disposable';

describe('Disposable', () => {
	describe('Disposable', () => {
		it('constructor accept a function', () => {
			// expect(() => { new Disposable(); }).to.throw(TypeError);
			expect(() => {
				new Disposable(() => {});
			}).to.not.throw(TypeError);
		});

		it('can be disposed', async () => {
			let toDispose = 2;
			const disposable = new Disposable(() => {
				toDispose -= 1;
			});
			expect(disposable.isDisposed()).to.equal(false);
			await disposable.dispose();
			expect(toDispose).to.equal(1);
			expect(disposable.isDisposed()).to.equal(true);
			await disposable.dispose();
			expect(toDispose).to.equal(1);
		});
	});

	describe('CompositeDisposable', () => {
		it('constructor accept a function', () => {
			expect(() => {
				new CompositeDisposable([]);
			}).to.not.throw(TypeError);
			expect(() => {
				new CompositeDisposable([new Disposable(() => {})]);
			}).to.not.throw(TypeError);
			expect(() => {
				new CompositeDisposable(new Set([new Disposable(() => {})]));
			}).to.not.throw(TypeError);
		});

		it('can add Disposable', async () => {
			let toDispose = 2;
			const composite = new CompositeDisposable([]);
			composite.add(
				new Disposable(() => {
					toDispose--;
				})
			);
			composite.add(
				new Disposable(() => {
					toDispose--;
				})
			);
			await composite.dispose();
			expect(toDispose).to.equal(0);
		});

		it('can remove Disposable', async () => {
			let toDispose = 2;
			const composite = new CompositeDisposable([]);
			const disposable = new Disposable(() => {
				toDispose--;
			});
			composite.add(
				new Disposable(() => {
					toDispose--;
				})
			);
			composite.add(disposable);
			composite.remove(disposable);
			await composite.dispose();
			expect(toDispose).to.equal(1);
		});

		it('can be disposed', async () => {
			let toDispose = 3;
			const composite = new CompositeDisposable([]);
			const disposable = new Disposable(() => {
				toDispose--;
			});
			composite.add(
				new Disposable(() => {
					toDispose--;
				})
			);
			composite.add(
				new Disposable(() => {
					toDispose--;
				})
			);

			await disposable.dispose();
			expect(composite.isDisposed()).to.equal(false);
			expect(toDispose).to.equal(2);
			await composite.dispose();
			expect(composite.isDisposed()).to.equal(true);
			await composite.dispose();
			expect(toDispose).to.equal(0);
			composite.clear();
			composite.remove(disposable);
			expect(toDispose).to.equal(0);
		});

		it('can clear all disposable', async () => {
			let toDispose = 3;
			const composite = new CompositeDisposable([]);
			const disposable = new Disposable(() => {
				toDispose--;
			});
			composite.add(disposable);
			composite.clear();
			await composite.dispose();
			expect(toDispose).to.equal(3);
		});
	});
});
