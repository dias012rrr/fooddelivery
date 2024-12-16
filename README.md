## Food Delivery Management System
# Description
The Food Delivery Management System is a web-based application designed to manage food menus and customer orders. It is aimed at restaurant managers and customers, allowing for seamless interaction through a simple and intuitive interface. The system provides functionality for menu management, placing orders, and viewing order details.

# Team Members
Arman Bezhanov
Dias Adilkhan
Danial Turzhanov


# Screenshot of the Main Page

![Main Page](https://github.com/dias012rrr/fooddelivery/blob/main/5404458624341897279.jpg)


How to Start the Project
Prerequisites
Install Go (version 1.19 or higher).
Set up a PostgreSQL database and update the connection details in the main.go file:
go

dsn := "host=localhost user=postgres password=Nurlan25 dbname=fooddelivery port=27030 sslmode=disable"
Install dependencies using:


go mod tidy
Steps
Start the Backend Server:

Navigate to the project directory containing main.go.
Run the following command:
bash

go run main.go
The server will be available on http://localhost:8080.

Frontend:

Open the HTML/CSS files provided in a browser to interact with the backend APIs.

Database:

Ensure the PostgreSQL database is running with tables auto-created during startup. Default menu items are seeded for demonstration purposes.
Tools and Resources Used
Backend: Go, Gorilla Mux, GORM
Frontend: HTML, CSS
Database: PostgreSQL
Styling: Custom CSS
Repository Structure

/food-delivery
├── main.go          # Backend logic
├── style.css        # Styling for the frontend
├── go.mod           # Module dependencies
├── go.sum           # Module dependency hashes


### Features

# Menu Management:
View existing menu items.
Add new menu items.

# Order Management:
Place orders with selected menu items.
Retrieve order details by ID.
List all customer orders.
