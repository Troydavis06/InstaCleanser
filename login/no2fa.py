import customtkinter

from login import login
from utils import create_welcome_frame

def startNo2fa(root):
    # Clear existing widgets from the root window
    for widget in root.winfo_children():
        widget.destroy()

    # Create a new frame for the No 2FA screen
    frame = customtkinter.CTkFrame(master=root)
    frame.pack(pady=20, padx=60, fill="both", expand=True)

    # Add content to the No 2FA frame
    label = customtkinter.CTkLabel(master=frame, text="Enter Your Instagram Login", font=("Roboto", 24))
    label.pack(pady=12, padx=10)

    # Username & Password Buttons
    entry1 = customtkinter.CTkEntry(master=frame, text="Login", command=lambda: login.login("a","b"))


    button = customtkinter.CTkButton(master=frame, text="Back to Main", command=lambda: create_welcome_frame(root))
    button.pack(pady=12, padx=10)