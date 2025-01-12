import customtkinter
from utils import create_welcome_frame

# Configure Colors
customtkinter.set_appearance_mode("dark")
customtkinter.set_default_color_theme("green")

# Init Root & Configure Size
root = customtkinter.CTk()
root.geometry("1000x700")

# Create initial welcome frame
create_welcome_frame(root)

# Run app
root.mainloop()