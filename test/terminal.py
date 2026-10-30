"""Real keyboard smoke checks: python3 test/terminal.py (macOS/Linux)."""
import fcntl
import json
import os
import pathlib
import pty
import re
import select
import signal
import struct
import tempfile
import termios
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = json.loads((ROOT / 'google-fonts.json').read_text())['items']


def check(name, steps):
    with tempfile.TemporaryDirectory(prefix='ggfonts-pty-') as home:
        data = pathlib.Path(home) / '.ggfonts'
        data.mkdir()
        (data / 'google-fonts.min.json').write_text(json.dumps({'items': FONTS}))
        pid, fd = pty.fork()
        if pid == 0:
            os.chdir(ROOT)
            env = dict(os.environ, HOME=home, TERM='xterm-256color', NO_COLOR='1', FORCE_COLOR='0')
            os.execvpe('node', ['node', 'index.js'], env)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 90, 0, 0))
        output = ''

        def read():
            nonlocal output
            if select.select([fd], [], [], .05)[0]:
                try:
                    output += os.read(fd, 65536).decode(errors='replace')
                except OSError:
                    pass

        def expect(text, start=0):
            deadline = time.monotonic() + 6
            while text not in re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', output[start:]):
                read()
                assert time.monotonic() < deadline, (name, text, output[-2000:])

        try:
            expect('What would you like to do?')
            for keys, expected in steps:
                mark = len(output)
                os.write(fd, keys)
                expect(expected, mark)
            deadline = time.monotonic() + 5
            while True:
                read()
                done, status = os.waitpid(pid, os.WNOHANG)
                if done:
                    break
                assert time.monotonic() < deadline, (name, 'did not exit', output[-2000:])
            assert os.waitstatus_to_exitcode(status) == 0, output[-2000:]
            assert not (data / 'API_KEY').exists()
            assert not (data / 'tmp').exists()
            assert 'hidden-key' not in output
            print(f'PASS: {name} ({len(FONTS)} fonts)')
        finally:
            try:
                os.kill(pid, signal.SIGKILL)
                os.waitpid(pid, 0)
            except (ProcessLookupError, ChildProcessError):
                pass
            os.close(fd)


check('main Exit', [(b'\x1b[A\r', 'See you next time!')])
check('main Ctrl+C', [(b'\x03', 'Cancelled.')])
check('picker Escape', [(b'\r', 'Choose a font'), (b'\x1b', 'Cancelled.')])
check('filter, arrow selection, decline, exit', [
    (b'\r', 'Choose a font'), (b'Fira', 'Fira Code'), (b'\x1b[B\r', 'Install Fira Mono'),
    (b'\r', 'What would you like to do?'), (b'\x1b[A\r', 'See you next time!')
])
check('no matches stays in picker', [
    (b'\r', 'Choose a font'), (b'zzzz-no-font', 'No matches found'),
    (b'\r', 'Choose a font from the list.'), (b'\x03', 'Cancelled.')
])
check('API key is masked on cancellation', [
    (b'\x1b[B\x1b[B\r', 'Choose a font metadata source'),
    (b'\x1b[B\r', 'Google Fonts API key'), (b'hidden-key\x03', 'Cancelled.')
])
