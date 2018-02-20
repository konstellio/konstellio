import { EOL } from 'os';
import { emitKeypressEvents, clearScreenDown, moveCursor } from 'readline';
import { WriteStream, ReadStream } from 'tty';

export function promptSelection(stdin: ReadStream, stdout: WriteStream, question: string, selections: Map<string, string>): Promise<string> {
	return new Promise((resolve, reject) => {
		emitKeypressEvents(stdin);
		stdin.setRawMode(true);

		stdout.write(question + EOL);
		stdout.write(EOL);

		let selectedIndex = 0;
		let resetSelection = 0;

		function drawSelections() {
			let out = '';
			let i = -1;
			selections.forEach((label, key) => {
				const idx = ++i;
				out += `  [${idx === selectedIndex ? 'x' : ' '}] ${label}${EOL}`;
			});
			out += EOL;

			moveCursor(stdout, 0, resetSelection);
			clearScreenDown(stdout);
			stdout.write(out);

			// resetSelection = -out.length;
			resetSelection = -(out.split(EOL).length - 1);
		}

		stdin.on('keypress', (chunk, key) => {
			if (key.name === 'up') {
				selectedIndex = Math.max(0, selectedIndex - 1);
				drawSelections();
			}
			else if (key.name === 'down') {
				selectedIndex = Math.min(selections.size - 1, selectedIndex + 1);
				drawSelections();
			}
			else if (key.name === 'return') {
				stdin.pause();
				stdin.setRawMode(false);

				const choice = Array.from(selections.keys())[selectedIndex];

				resolve(choice);
			}
			else if (key.sequence === "\u0003") {
				stdin.pause();
				stdin.setRawMode(false);

				reject(new Error(`User aborted selection.`));
			}
		});

		drawSelections();
	});
}