import customtkinter

def create_welcome_frame(root):
    # Clear existing widgets
    for widget in root.winfo_children():
        widget.destroy()

    # Recreate the welcome frame
    frame = customtkinter.CTkFrame(master=root)
    frame.pack(pady=20, padx=60, fill="both", expand=True)

    label = customtkinter.CTkLabel(master=frame, text="Welcome!", font=("Roboto", 24))
    label.pack(pady=12, padx=10)

    label = customtkinter.CTkLabel(master=frame, text="Does your account have 2 factor authentication?", font=("Roboto", 24))
    label.pack(pady=12, padx=10)

    # Import here to avoid circular imports
    import login.no2fa
    import login.with2fa

    # Add Buttons
    noButton = customtkinter.CTkButton(master=frame, text="No", command=lambda: login.no2fa.startNo2fa(root))
    noButton.pack(pady=12, padx=10)

    yesButton = customtkinter.CTkButton(master=frame, text="Yes", command=lambda: login.with2fa.startWith2fa(root))
    yesButton.pack(pady=12, padx=10)