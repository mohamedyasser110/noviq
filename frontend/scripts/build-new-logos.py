"""
Alias to build-logos.py for backward compatibility.
"""
import os
import subprocess
import sys

if __name__ == '__main__':
    target = os.path.join(os.path.dirname(__file__), 'build-logos.py')
    res = subprocess.run([sys.executable, target])
    sys.exit(res.returncode)
