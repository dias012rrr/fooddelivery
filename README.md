# Food Delivery Management System

## Description
The **Food Delivery Management System** is a web-based application designed to manage food menus and customer orders. It is aimed at restaurant managers and customers, allowing for seamless interaction through a simple and intuitive interface. The system provides functionality for menu management, placing orders, and viewing order details.

---

## Team Members
- Arman Bezhanov  
- Dias Adilkhan  
- Danial Turzhanov  

---

## Screenshot of the Main Page
![Main Page](https://github.com/dias012rrr/fooddelivery/blob/main/5404458624341897279.jpg)

---

## How to Start the Project

### Prerequisites
1. Install [Go](https://go.dev/) (version 1.19 or higher).
2. Set up a PostgreSQL database and update the connection details in the `main.go` file:
   ```go
   dsn := "host=localhost user=postgres password=Nurlan25 dbname=fooddelivery port=27030 sslmode=disable"

## Install dependencies

To install the required dependencies, run the following command:

```bash
go mod tidy


## Steps

### 1. Start the Backend Server

- Navigate to the project directory containing `main.go`.
- Run the following command to start the backend server:
  ```bash
  go run main.go

The server will be available at http://localhost:8080.

### 2. Frontend

- Open the provided HTML/CSS files in a browser.
- These files will interact with the backend APIs, allowing you to view and manage the menu and orders.

---

### 3. Database

- Ensure that the PostgreSQL database is running.
- During server startup, the necessary tables will be auto-created.
- Default menu items will be seeded automatically for demonstration purposes.


## Tools and Resources Used

| **Tool/Resource**  | **Purpose**              |
|--------------------|--------------------------|
| **Go**             | Backend development      |
| **Gorilla Mux**    | HTTP routing framework   |
| **GORM**           | Object Relational Mapping|
| **PostgreSQL**     | Database management      |
| **HTML/CSS**       | Frontend styling         |

## Features
# Menu Management
View existing menu items.
Add new menu items.

# Order Management
Place orders with selected menu items.
Retrieve order details by ID.
List all customer orders.
