import sys

# Allocate memory until OOM killed
print("Starting memory allocation to trigger OOM...")
sys.stdout.flush()
data = []
while True:
    data.append('x' * 10_000_000)
