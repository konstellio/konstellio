import { EOL } from 'os';
import { emitKeypressEvents, clearScreenDown, moveCursor, createInterface } from 'readline';
import { WriteStream, ReadStream } from 'tty';
import { blue, cyan } from 'colors/safe';

/**
 * Prompt question to user and return answer
 */
export function promptQuestion(stdin: ReadStream, stdout: WriteStream, question: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const rl = createInterface({
			input: stdin,
			output: stdout
		});

		function onClose() {
			rl.removeListener('close', onClose);
			rl.close();
			reject(new Error(`User aborted question.`));
		}

		rl.question(question, (response) => {
			rl.removeListener('close', onClose);
			rl.close();
			resolve(response);
		});

		rl.on('close', onClose);
	})
}

/**
 * Prompt selection to user and return answer
 */
export function promptSelection(stdin: ReadStream, stdout: WriteStream, question: string, selections: Map<string, string>): Promise<string> {
	return new Promise((resolve, reject) => {
		emitKeypressEvents(stdin);
		stdin.resume();
		stdin.setRawMode(true);

		stdout.write(question + EOL);
		// stdout.write(EOL);

		let selectedIndex = 0;
		let resetSelection = 0;

		function drawSelections() {
			let out = '';
			let i = -1;
			selections.forEach((label, key) => {
				const idx = ++i;
				if (idx === selectedIndex) {
					out += cyan(`  > ${label}${EOL}`);
				} else {
					out += `    ${label}${EOL}`;
				}
			});
			out += EOL;

			moveCursor(stdout, 0, resetSelection);
			clearScreenDown(stdout);
			stdout.write(out);

			// resetSelection = -out.length;
			// resetSelection = -(out.split(EOL).length - 1);
			resetSelection = -(out.split(EOL).length);
		}

		function onKeyPress(_: Buffer, key: any) {
			if (key.name === 'up') {
				selectedIndex = Math.max(0, selectedIndex - 1);
				drawSelections();
			}
			else if (key.name === 'down') {
				selectedIndex = Math.min(selections.size - 1, selectedIndex + 1);
				drawSelections();
			}
			else if (key.name === 'return') {
				stdin.removeListener('keypress', onKeyPress);
				stdin.pause();
				stdin.setRawMode(false);

				const choice = Array.from(selections.keys())[selectedIndex];

				resolve(choice);
			}
			else if (key.sequence === "\u0003") {
				stdin.removeListener('keypress', onKeyPress);
				stdin.pause();
				stdin.setRawMode(false);

				reject(new Error(`User aborted selection.`));
			}
		}

		stdin.on('keypress', onKeyPress);

		drawSelections();
	});
}