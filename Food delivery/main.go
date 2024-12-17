package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type FoodItem struct {
	ID          uint    `json:"id" gorm:"primaryKey"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
}

type Order struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	Customer  string     `json:"customer"`
	Address   string     `json:"address"`
	Total     float64    `json:"total"`
	FoodItems []FoodItem `json:"food_items" gorm:"many2many:order_food_items;"`
}

var db *gorm.DB

func initDatabase() {
	var err error
	dsn := "host=localhost user=postgres password=Nurlan25 dbname=fooddelivery port=27030 sslmode=disable" // the postgres pgadmin database info
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	fmt.Println("Database connected!")

	err = db.AutoMigrate(&FoodItem{}, &Order{})
	if err != nil {
		log.Fatal("Failed to auto-migrate database:", err)
	}
	fmt.Println("Database migrated (tables ensured)!")

	var count int64
	db.Model(&FoodItem{}).Count(&count)
	if count == 0 {
		seedMenu()
	}
}

func seedMenu() {
	items := []FoodItem{
		{Name: "Pizza Pepperoni", Description: "Classic pepperoni pizza", Price: 2700},
		{Name: "Bucket Sanders Trio", Description: "Chicken basket with three sauces", Price: 6400},
		{Name: "Pepsi 0.5", Description: "0.5L bottle of Pepsi", Price: 650},
		{Name: "Lipton Ice Tea 0.5", Description: "0.5L bottle of Lipton Ice Tea", Price: 650},
	}
	for _, item := range items {
		db.Create(&item)
	}
	fmt.Println("✅ Initial menu items added!")
}

func getMenu(w http.ResponseWriter, r *http.Request) {
	var items []FoodItem
	db.Find(&items)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func addMenuItem(w http.ResponseWriter, r *http.Request) {
	var item FoodItem
	err := json.NewDecoder(r.Body).Decode(&item)
	if err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	db.Create(&item)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

func placeOrder(w http.ResponseWriter, r *http.Request) {
	var order Order
	err := json.NewDecoder(r.Body).Decode(&order)
	if err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	var total float64
	var foodItems []FoodItem
	for _, foodItem := range order.FoodItems {
		var dbItem FoodItem
		db.First(&dbItem, foodItem.ID)
		if dbItem.ID == 0 {
			http.Error(w, "Food item not found", http.StatusNotFound)
			return
		}
		foodItems = append(foodItems, dbItem)
		total += dbItem.Price
	}
	order.FoodItems = foodItems
	order.Total = total

	db.Create(&order)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func getOrder(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, _ := strconv.Atoi(params["id"])
	var order Order
	result := db.Preload("FoodItems").First(&order, id)
	if result.Error != nil {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func getAllOrders(w http.ResponseWriter, r *http.Request) {
	var orders []Order
	result := db.Preload("FoodItems").Find(&orders)
	if result.Error != nil {
		http.Error(w, "Failed to fetch orders", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

func deleteMenuItem(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid ID format", http.StatusBadRequest)
		return
	}

	var item FoodItem
	result := db.First(&item, id)
	if result.Error != nil {
		http.Error(w, "Menu item not found", http.StatusNotFound)
		return
	}

	db.Delete(&item)
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Menu item with ID %d deleted successfully", id)
}


func deleteOrder(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid ID format", http.StatusBadRequest)
		return
	}

	var order Order
	result := db.First(&order, id)
	if result.Error != nil {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	db.Delete(&order)
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Order with ID %d deleted successfully", id)
}

func main() {
	initDatabase()
	r := mux.NewRouter()
	r.HandleFunc("/menu", getMenu).Methods("GET")
	r.HandleFunc("/menu", addMenuItem).Methods("POST")
	r.HandleFunc("/order", placeOrder).Methods("POST")
	r.HandleFunc("/orders", getAllOrders).Methods("GET")
	r.HandleFunc("/menu/{id}", deleteMenuItem).Methods("DELETE")
	r.HandleFunc("/order/{id}", deleteOrder).Methods("DELETE")
	r.HandleFunc("/order/{id}", getOrder).Methods("GET")

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
	})
	handler := c.Handler(r)

	fmt.Println("Server running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
