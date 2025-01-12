import instaloader

# Initialize Instaloader
L = instaloader.Instaloader()

def login(username, password):
    print("can  be reached")
    try:
        L.login(username, password)
    except instaloader.TwoFactorAuthRequiredException:
        code = "temp"
        L.two_factor_login(code)