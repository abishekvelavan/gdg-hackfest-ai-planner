import sys
import base64

try:
    with open("assets/images/icon.png", "wb") as fh:
        # We need the user to give us the actual image. Our curl command above just pulled the existing icon
        pass
except Exception as e:
    print(e)
