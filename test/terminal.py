"""Real keyboard smoke checks: python3 test/terminal.py (macOS/Linux)."""
import fcntl
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


def check(name, steps, install=False, network=None, initial_text='Choose a font (Esc/Ctrl+C to exit)'):
    with tempfile.TemporaryDirectory(prefix="ggfonts pty José's home-") as home:
        data = pathlib.Path(home) / '.ggfonts'
        pid, fd = pty.fork()
        if pid == 0:
            os.chdir(ROOT)
            env = dict(os.environ, HOME=home, TERM='xterm-256color', FORCE_COLOR='1')
            env.pop('NO_COLOR', None)
            env['GGFONTS_NETWORK'] = network or ('nested' if install else 'success')
            args = ['node', '--require', './test/fixtures/network.cjs', 'index.js']
            os.execvpe('node', args, env)
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
            expect(initial_text)
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
            clean = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', output)
            assert clean.count('See you next time!') == 1, clean[-4000:]
            assert 'Cancelled.' not in clean, clean[-4000:]
            exit_line = next(line for line in output.splitlines() if 'See you next time!' in line)
            assert '\x1b[31m' not in exit_line, exit_line
            if install:
                assert 'Downloading ' not in clean, clean[-4000:]
                assert 'Downloaded ' not in clean, clean[-4000:]
                assert 'Stored at:' not in clean, clean[-4000:]
                assert 'Installed files: 2' in clean, clean[-4000:]
                assert 'Location:' in clean, clean[-4000:]
                assert '  - FiraCode-Bold.OTF' in clean, clean[-4000:]
                assert '  - FiraCode.ttf' in clean, clean[-4000:]
                assert not list((data / 'tmp').iterdir())
            elif network == 'slow':
                fonts = pathlib.Path(home) / ('Library/Fonts' if os.uname().sysname == 'Darwin' else '.local/share/fonts')
                assert not fonts.exists()
                assert 'Installation summary:' not in clean, clean[-4000:]
            else:
                assert not data.exists()
            print(f'PASS: {name}')
        finally:
            try:
                os.kill(pid, signal.SIGKILL)
                os.waitpid(pid, 0)
            except (ProcessLookupError, ChildProcessError):
                pass
            os.close(fd)


check('picker Ctrl+C', [(b'\x03', 'See you next time!')])
check('picker Escape', [(b'\x1b', 'See you next time!')])
check('filter, arrow selection, decline, exit', [
    (b'Fira', 'Search: Fira'), (b'\x1b[B\r', 'Install Fira Mono'),
    (b'\x1b[C\r', 'Choose a font'), (b'\x1b', 'See you next time!')
])
check('no matches stays in picker', [
    (b'zzzz-no-font', 'No matches found'),
    (b'\r', 'Choose a font from the list.'), (b'\x03', 'See you next time!')
])
check('Enter installs by default, shows only the report, and returns to the picker', [
    (b'Fira Code\r', 'Install Fira Code'),
    (b'\r', 'Choose a font'), (b'\x1b', 'See you next time!')
], install=True)

check('Ctrl+C during catalogue loading exits normally', [
    (b'\x03', 'See you next time!')
], network='catalogue-slow', initial_text='Fetching font catalogue')
check('Ctrl+C during installation exits normally', [
    (b'Fira Code\r', 'Install Fira Code'),
    (b'\r', 'Installing Fira Code'), (b'\x03', 'See you next time!')
], network='slow')
