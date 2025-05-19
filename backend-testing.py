# Fully for testing before implemented inside actual application.
# Testing Cases:
#   Test 1: Fail, I think because too many requests to log into my account
#   Test 2:
#   Test 3:

import instaloader

def login_to_instagram(username, password):
    """
    Logs in to Instagram using instaloader
    Returns loader, profile if successful else None, None
    """

    loader = instaloader.Instaloader()

    try:
        loader.context.log("Attempting login...")
        loader.login(username, password)

        # If 2FA is needed, the exception will be passed
        profile = instaloader.Profile.from_username(loader.context, username)
        return loader, profile

    except instaloader.exceptions.TwoFactorAuthRequiredException:
        print("Two-Factor Authentication required.")
        try:
            verification_code = input("Enter the Instagram 2FA code: ")
            loader.context.do_login(username, password)
            loader.context.two_factor_login(verification_code)
            profile = instaloader.Profile.from_username(loader.context, username)
            return loader, profile
        except Exception as e:
            print("2FA login failed:", e)
            return None, None

def get_followers(profile):
    """ Returns a set of follower profiles """
    return set(profile.get_followers())

def get_followees(profile):
    """ Returns a set of followee profiles """
    return set(profile.get_followees())

def get_all_information(profile):
    """
    Compares followers and followees creating a set of who doesn't follow you back and another set with who you don't follow back.
    Returns a dictionary with both of those sets, as well as the followers and followees sets.
    """

    followers = get_followers(profile)
    followees = get_followees(profile)

    not_following_back = followees-followers
    you_dont_follow_back = followers-followees

    return{
        "followers" : followers,
        "followees" : followees,
        "not_following_back" : not_following_back,
        "you_dont_follow_back" : you_dont_follow_back
    }

def main():
    print("TESTING INTERFACE\n")

    username = input("Enter Instagram Username: ")
    password = input("Enter Instagram Password: ")

    loader, profile = login_to_instagram(username, password)

    if profile is None:
        print("Login Failed")
        return

    print(f"Logged in as {profile.username}")

    data = get_all_information(profile)

    print("Followers Set:")
    for user in data['followers']:
        print(f" - {user.username}")
    print()

    print("➡Followees Set:")
    for user in data['followees']:
        print(f" - {user.username}")
    print()

    print("Not Following You Back Set:")
    for user in data['not_following_back']:
        print(f" - {user.username}")
    print()

    print("You Don't Follow Back Set:")
    for user in data['you_dont_follow_back']:
        print(f" - {user.username}")
    print()

if __name__ == "__main__":
    main()