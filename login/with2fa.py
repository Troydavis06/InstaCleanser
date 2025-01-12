import customtkinter
from utils import create_welcome_frame

def startWith2fa(root):
    # Clear  widgets from the root window
    for widget in root.winfo_children():
        widget.destroy()

    # Create a new frame for the With 2FA screen
    frame = customtkinter.CTkFrame(master=root)
    frame.pack(pady=20, padx=60, fill="both", expand=True)

    # Add content to the With 2FA frame
    label = customtkinter.CTkLabel(master=frame, text="With 2FA Screen", font=("Roboto", 24))
    label.pack(pady=12, padx=10)

    # Add a back button to return to the main screen
    button = customtkinter.CTkButton(master=frame, text="Back to Main", command=lambda: create_welcome_frame(root))
    button.pack(pady=12, padx=10)