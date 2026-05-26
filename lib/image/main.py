import time

# App starts and stays alive but doesn't serve HTTP on port 8080
# ALB health check to /health will always fail
print("App started, but not listening on any port...")
while True:
    time.sleep(60)
