"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const readline_1 = require("readline");
const safe_1 = require("colors/safe");
/**
 * Prompt question to user and return answer
 */
function promptQuestion(stdin, stdout, question) {
    return new Promise((resolve, reject) => {
        const rl = readline_1.createInterface({
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
    });
}
exports.promptQuestion = promptQuestion;
/**
 * Prompt selection to user and return answer
 */
function promptSelection(stdin, stdout, question, selections) {
    return new Promise((resolve, reject) => {
        readline_1.emitKeypressEvents(stdin);
        stdin.resume();
        stdin.setRawMode(true);
        stdout.write(question + os_1.EOL);
        // stdout.write(EOL);
        let selectedIndex = 0;
        let resetSelection = 0;
        function drawSelections() {
            let out = '';
            let i = -1;
            selections.forEach((label, key) => {
                const idx = ++i;
                if (idx === selectedIndex) {
                    out += safe_1.cyan(`  > ${label}${os_1.EOL}`);
                }
                else {
                    out += `    ${label}${os_1.EOL}`;
                }
            });
            out += os_1.EOL;
            readline_1.moveCursor(stdout, 0, resetSelection);
            readline_1.clearScreenDown(stdout);
            stdout.write(out);
            // resetSelection = -out.length;
            // resetSelection = -(out.split(EOL).length - 1);
            resetSelection = -(out.split(os_1.EOL).length);
        }
        function onKeyPress(_, key) {
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
exports.promptSelection = promptSelection;
//# sourceMappingURL=cli.js.map