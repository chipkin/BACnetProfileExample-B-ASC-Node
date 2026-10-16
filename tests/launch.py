# SPDX-License-Identifier: CC0-1.0
# Public-domain example code (CC0) - see ../LICENSE.
"""Start the example from a COMMAND LINE, not just one executable.

The Wire Tests were written for the C++ example, where --exe names one binary. This
example runs under Node.js, so --exe takes a whole command instead - by default

    node <repository>/dist/main.js

(build it first: `npm install && npm run build`). Any command works, e.g.
--exe "node dist/main.js" or --exe "npx tsx main.ts". The command is split like a shell
would (quotes group, backslashes in Windows paths are kept), its program is looked up on
PATH, and a relative path that exists is made absolute. Then it is started through the
vendored harness, unchanged: wiretest.start(program, rest + arguments, ...).

This is the only change to the reference's tests/ beyond the --exe default: each
`wiretest.start(args.exe, ...)` is `launch.start(args.exe, ...)`.
"""
import os
import shlex
import shutil
import sys
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY))

import wiretest  # noqa: E402  (the vendored harness at the repository root)


def default_command():
    """`node <repository>/dist/main.js`, quoted so a path with spaces survives the split."""
    return f'node "{REPOSITORY / "dist" / "main.js"}"'


def split_command(command):
    """The command's words: shell-like, but keeping backslashes (Windows paths)."""
    words = shlex.split(command, posix=False)
    return [word[1:-1] if len(word) >= 2 and word[0] == word[-1] and word[0] in "\"'" else word
            for word in words]


def start(command, arguments, label, environment=None):
    """wiretest.start for a command line: the first word is the program, the rest come
    before `arguments`."""
    words = split_command(command)
    if not words:
        sys.exit("--exe is empty")
    program = shutil.which(words[0]) or words[0]
    rest = [str(Path(word).resolve()) if not word.startswith("-") and os.path.exists(word) else word
            for word in words[1:]]
    return wiretest.start(program, rest + list(arguments), label, environment)
