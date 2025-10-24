"""Entry point for running aitrace as a module."""
import sys

from .server import main

if __name__ == "__main__":
    sys.exit(main())

