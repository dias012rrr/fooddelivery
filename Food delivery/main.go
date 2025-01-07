package main

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
	"gopkg.in/gomail.v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

var (
	db      *gorm.DB
	logger  = logrus.New()
	limiter = rate.NewLimiter(1, 5)
)

// Models
type SupportMessage struct {
	ID          uint   `json:"id" gorm:"primaryKey"`
	Email       string `json:"email"`
	Message     string `json:"message"`
	Attachments string `json:"attachments"`
	CreatedAt   time.Time
}

type User struct {
	ID       uint       `json:"id" gorm:"primaryKey"`
	Name     string     `json:"name"`
	Email    string     `json:"email" gorm:"unique;not null"`
	Phone    string     `json:"phone"`
	Password string     `json:"password"`
	Role     string     `json:"role"`
	Cart     []FoodItem `json:"cart" gorm:"many2many:user_cart_items;constraint:OnDelete:CASCADE"`
	Orders   []Order    `json:"orders" gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
}

type FoodItem struct {
	ID          uint    `json:"id" gorm:"primaryKey"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Category    string  `json:"category"`
	PictureURL  string  `json:"picture_url"`
	Orders      []Order `json:"-" gorm:"many2many:order_food_items;constraint:OnDelete:CASCADE;"`
}

type Order struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	Customer  string     `json:"customer"`
	Address   string     `json:"address"`
	Total     float64    `json:"total"`
	FoodItems []FoodItem `json:"food_items" gorm:"many2many:order_food_items;constraint:OnDelete:CASCADE"`
	UserID    uint       `json:"user_id"`
	User      User       `json:"-" gorm:"foreignKey:UserID;references:ID"`
}

func initLogger() {
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetLevel(logrus.InfoLevel)
	logger.Info("Logger initialized")
}

func sendSupportMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		log.Println("Failed to parse form data:", err)
		http.Error(w, "Failed to parse form data", http.StatusBadRequest)
		return
	}

	email := r.FormValue("email")
	message := r.FormValue("message")
	if email == "" || message == "" {
		log.Println("Email or message is missing")
		http.Error(w, "Email and message are required", http.StatusBadRequest)
		return
	}
	log.Printf("Received email: %s, message: %s", email, message)

	var attachmentPaths []string
	files := r.MultipartForm.File["attachments"]
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			log.Println("Failed to process attachment:", err)
			http.Error(w, "Failed to process attachment", http.StatusInternalServerError)
			return
		}
		defer file.Close()

		tempPath := filepath.Join(os.TempDir(), fileHeader.Filename)

		out, err := os.Create(tempPath)
		if err != nil {
			log.Println("Failed to save attachment:", err)
			http.Error(w, "Failed to save attachment", http.StatusInternalServerError)
			return
		}
		defer out.Close()
		_, err = io.Copy(out, file)
		if err != nil {
			log.Println("Failed to write attachment to file:", err)
			http.Error(w, "Failed to save attachment", http.StatusInternalServerError)
			return
		}
		attachmentPaths = append(attachmentPaths, tempPath)
	}
	log.Printf("Attachments saved: %v", attachmentPaths)

	newMessage := SupportMessage{
		Email:       email,
		Message:     message,
		Attachments: strings.Join(attachmentPaths, ","),
	}
	if err := db.Create(&newMessage).Error; err != nil {
		log.Println("Failed to save message in database:", err)
		http.Error(w, "Failed to save message", http.StatusInternalServerError)
		return
	}
	log.Println("Message saved in database")

	from := "#"
	password := "#" //нужно заполнить
	to := "#"       //нужно заполнить
	m := gomail.NewMessage()
	m.SetHeader("From", from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", "Support Request")
	m.SetBody("text/plain", fmt.Sprintf("Message from %s:\n\n%s", email, message))

	for _, path := range attachmentPaths {
		m.Attach(path)
	}

	d := gomail.NewDialer("smtp.gmail.com", 587, from, password)
	if err := d.DialAndSend(m); err != nil {
		log.Println("Failed to send email:", err)
		http.Error(w, "Failed to send email", http.StatusInternalServerError)
		return
	}
	log.Println("Email sent successfully")

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Message sent successfully"))
}

func initDatabase() {
	var err error
	dsn := "host=localhost user=postgres password=Nurlan25 dbname=delivery port=27030 sslmode=disable"
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	fmt.Println("Database connected!")
	err = db.AutoMigrate(&User{}, &FoodItem{}, &Order{})
	if err != nil {
		log.Fatal("Failed to auto-migrate database:", err)
	}
	fmt.Println("Database migrated (tables ensured)!")
	err = db.AutoMigrate(&SupportMessage{})
	if err != nil {
		log.Fatal("Failed to auto-migrate SupportMessage:", err)
	}

	var count int64
	db.Model(&FoodItem{}).Count(&count)
	if count == 0 {
		seedMenu()
	}
}
func getFilteredFoodItems(w http.ResponseWriter, r *http.Request) {
	var foodItems []FoodItem
	query := db.Model(&FoodItem{})
	category := r.URL.Query().Get("category")
	minPrice := r.URL.Query().Get("minPrice")
	maxPrice := r.URL.Query().Get("maxPrice")
	search := r.URL.Query().Get("search")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 10
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if minPrice != "" {
		if min, err := strconv.ParseFloat(minPrice, 64); err == nil {
			query = query.Where("price >= ?", min)
		} else {
			http.Error(w, "Invalid minPrice value", http.StatusBadRequest)
			return
		}
	}
	if maxPrice != "" {

		if max, err := strconv.ParseFloat(maxPrice, 64); err == nil {
			query = query.Where("price <= ?", max)
		} else {
			http.Error(w, "Invalid maxPrice value", http.StatusBadRequest)
			return
		}
	}
	if search != "" {
		query = query.Where("name ILIKE ? OR description ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	offset := (page - 1) * limit
	query = query.Offset(offset).Limit(limit)

	if err := query.Find(&foodItems).Error; err != nil {
		http.Error(w, "Ошибка загрузки еды", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"data":  foodItems,
		"page":  page,
		"limit": limit,
		"total": total,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func checkAuth(w http.ResponseWriter, r *http.Request) {
	email := r.Header.Get("X-User-Email")
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user User
	result := db.Where("email = ?", email).First(&user)
	if result.Error != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	json.NewEncoder(w).Encode(user)
}
func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !limiter.Allow() {
			logger.WithField("ip", r.RemoteAddr).Warn("Rate limit exceeded")
			http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func seedMenu() {
	items := []FoodItem{
		{Name: "Classic Burger", Description: "Juicy beef patty with fresh lettuce, tomato, and our special sauce", Price: 9.99, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1170&q=80"},
		{Name: "Margherita Pizza", Description: "Traditional Italian pizza with tomato sauce, mozzarella, and basil", Price: 12.99, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&w=1074&q=80"},
		{Name: "Caesar Salad", Description: "Crisp romaine lettuce, croutons, and parmesan cheese with Caesar dressing", Price: 7.99, Category: "appetizers", PictureURL: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=1170&q=80"},
		{Name: "Chicken Wings", Description: "Crispy chicken wings tossed in your choice of sauce", Price: 8.99, Category: "appetizers", PictureURL: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=1080&q=80"},
		{Name: "Chocolate Lava Cake", Description: "Decadent chocolate cake with a gooey molten center", Price: 6.99, Category: "desserts", PictureURL: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&w=1170&q=80"},
		{Name: "Iced Latte", Description: "Smooth espresso with cold milk over ice", Price: 3.99, Category: "drinks", PictureURL: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=1170&q=80"},
		{Name: "Grilled Chicken Sandwich", Description: "Grilled chicken breast with lettuce and mayo", Price: 10.49, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1597579018905-8c807adfbed4?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8R3JpbGxlZCUyMENoaWNrZW4lMjBTYW5kd2ljaHxlbnwwfHwwfHx8MA%3D%3D"},
		{Name: "Vegetarian Wrap", Description: "Fresh vegetables wrapped in a soft tortilla", Price: 8.49, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1592044903782-9836f74027c0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8VmVnZXRhcmlhbiUyMFdyYXB8ZW58MHx8MHx8fDA%3D"},
		{Name: "Pepperoni Pizza", Description: "Classic pizza with spicy pepperoni and cheese", Price: 13.99, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8UGVwcGVyb25pJTIwcGl6emF8ZW58MHx8MHx8fDA%3D"},
		{Name: "Garden Salad", Description: "Fresh garden vegetables with balsamic vinaigrette", Price: 6.99, Category: "appetizers", PictureURL: "https://images.unsplash.com/photo-1605291535126-2d71fea483c1?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z2FyZGVuJTIwc2FsYWQlMjBkaXNofGVufDB8fDB8fHww"},
		{Name: "Spaghetti Carbonara", Description: "Classic Italian pasta with creamy sauce", Price: 14.99, Category: "main-courses", PictureURL: "https://plus.unsplash.com/premium_photo-1674511582428-58ce834ce172?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8U3BhZ2hldHRpJTIwQ2FyYm9uYXJhfGVufDB8fDB8fHww"},
		{Name: "Beef Tacos", Description: "Spiced beef with fresh toppings in a crispy shell", Price: 9.49, Category: "main-courses", PictureURL: "https://plus.unsplash.com/premium_photo-1661730314652-911662c0d86e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8YmVlZiUyMHRhY29zfGVufDB8fDB8fHww"},
		{Name: "Shrimp Cocktail", Description: "Chilled shrimp with tangy cocktail sauce", Price: 11.99, Category: "appetizers", PictureURL: "https://images.unsplash.com/photo-1691201659377-978b28daa417?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8U2hyaW1wJTIwQ29ja3RhaWx8ZW58MHx8MHx8fDA%3D"},
		{Name: "Tomato Soup", Description: "Rich and creamy tomato soup with croutons", Price: 5.49, Category: "appetizers", PictureURL: "https://images.unsplash.com/photo-1629978444632-9f63ba0eff47?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8VG9tYXRvJTIwU291cHxlbnwwfHwwfHx8MA%3D%3D"},
		{Name: "Berry Smoothie", Description: "Mixed berry smoothie with a touch of honey", Price: 4.99, Category: "drinks", PictureURL: "https://images.unsplash.com/photo-1553177595-4de2bb0842b9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fEJlcnJ5JTIwU21vb3RoaWV8ZW58MHx8MHx8fDA%3D"},
		{Name: "Grilled Salmon", Description: "Perfectly grilled salmon with lemon butter", Price: 17.99, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fEdyaWxsZWQlMjBTYWxtb258ZW58MHx8MHx8fDA%3D"},
		{Name: "Margarita", Description: "Classic margarita with a salted rim", Price: 8.99, Category: "drinks", PictureURL: "https://images.unsplash.com/photo-1558017487-ce249cab792c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fG1hcmdhcml0YXxlbnwwfHwwfHx8MA%3D%3D"},
		{Name: "French Fries", Description: "Crispy golden fries with a side of ketchup", Price: 3.49, Category: "appetizers", PictureURL: "https://plus.unsplash.com/premium_photo-1672774750509-bc9ff226f3e8?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8RnJlbmNoJTIwZnJpZXN8ZW58MHx8MHx8fDA%3D"},
		{Name: "BBQ Ribs", Description: "Tender ribs glazed with BBQ sauce", Price: 19.99, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1723437395525-77b08e41e53c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8QkJRJTIwcmlic3xlbnwwfHwwfHx8MA%3D%3D"},
		{Name: "Cheesecake", Description: "Classic cheesecake with a graham cracker crust", Price: 6.49, Category: "desserts", PictureURL: "https://images.unsplash.com/photo-1702925614886-50ad13c88d3f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Q2hlZXNlY2FrZXxlbnwwfHwwfHx8MA%3D%3D"},
		{Name: "Veggie Pizza", Description: "Pizza topped with a variety of fresh vegetables", Price: 12.49, Category: "main-courses", PictureURL: "https://plus.unsplash.com/premium_photo-1690056321981-dfe9e75e0247?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8dmVnZ2llJTIwcGl6emF8ZW58MHx8MHx8fDA%3D"},
		{Name: "Chicken Alfredo", Description: "Pasta with creamy Alfredo sauce and grilled chicken", Price: 15.99, Category: "main-courses", PictureURL: "https://media.istockphoto.com/id/2161825710/photo/creamy-alfredo-pasto-in-a-white-plate.webp?a=1&b=1&s=612x612&w=0&k=20&c=Y89KirhVAKgVHcNgP8qzMxXDciCUBjHoccIG4chL6pU="},
		{Name: "Mac and Cheese", Description: "Creamy mac and cheese topped with breadcrumbs", Price: 9.49, Category: "main-courses", PictureURL: "https://media.istockphoto.com/id/516078243/photo/macaroni.webp?a=1&b=1&s=612x612&w=0&k=20&c=qNzQK0rx_YcG4qPT8dnvItdpkoImlEkGQ0mIoIWRHAo="},
		{Name: "Fish and Chips", Description: "Golden fried fish with crispy chips", Price: 14.49, Category: "main-courses", PictureURL: "https://plus.unsplash.com/premium_photo-1695758774479-faae1180b078?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8ZmlzaCUyMGFuZCUyMGNoaXBzfGVufDB8fDB8fHww"},
		{Name: "Mango Lassi", Description: "Refreshing mango yogurt drink", Price: 4.49, Category: "drinks", PictureURL: "https://plus.unsplash.com/premium_photo-1667251757355-b3db687473bc?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8bWFuZ28lMjBsYXNzaSUyMGp1aWNlfGVufDB8fDB8fHww"},
		{Name: "Panna Cotta", Description: "Italian dessert with a creamy texture", Price: 5.99, Category: "desserts", PictureURL: "https://plus.unsplash.com/premium_photo-1713913281130-4f8c78cdd02b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8cGFubmElMjBjb3R0YXxlbnwwfHwwfHx8MA%3D%3D"},
		{Name: "Ice Cream Sundae", Description: "Vanilla ice cream with toppings", Price: 5.49, Category: "desserts", PictureURL: "https://plus.unsplash.com/premium_photo-1664391744509-2a96af429dc4?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8aWNlJTIwY3JlYW0lMjBzdW5kYWV8ZW58MHx8MHx8fDA%3D"}, {Name: "Spring Rolls", Description: "Crispy rolls filled with fresh vegetables", Price: 7.99, Category: "appetizers", PictureURL: "https://plus.unsplash.com/premium_photo-1663850685033-a8557389963e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8U3ByaW5nJTIwUm9sbHN8ZW58MHx8MHx8fDA%3D"}, {Name: "Lemon Tart", Description: "Tart with a tangy lemon filling", Price: 6.49, Category: "desserts", PictureURL: "https://images.unsplash.com/photo-1614174486496-344ef3e9d870?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8TGVtb24lMjBUYXJ0fGVufDB8fDB8fHww"}, {Name: "Tuna Salad", Description: "Mixed greens with tuna and a light dressing", Price: 8.49, Category: "appetizers", PictureURL: "https://plus.unsplash.com/premium_photo-1695399566146-ed0214b5b883?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8VHVuYSUyMHNhbGFkfGVufDB8fDB8fHww"}, {Name: "Avocado Toast", Description: "Toasted bread topped with fresh avocado", Price: 6.99, Category: "appetizers", PictureURL: "https://images.unsplash.com/photo-1687276287139-88f7333c8ca4?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8YXZvY2FkbyUyMHRvYXN0fGVufDB8fDB8fHww"}, {Name: "Veggie Stir Fry", Description: "Mixed vegetables stir-fried with soy sauce", Price: 11.99, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1599297915779-0dadbd376d49?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8VmVnZ2llJTIwU3RpciUyMEZyeXxlbnwwfHwwfHx8MA%3D%3D"}, {Name: "Grilled Shrimp", Description: "Marinated shrimp grilled to perfection", Price: 15.99, Category: "main-courses", PictureURL: "https://images.unsplash.com/photo-1723325697529-6e2679650b39?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Z3JpbGxlZCUyMHNocmltcHxlbnwwfHwwfHx8MA%3D%3D"}, {Name: "Pancakes", Description: "Fluffy pancakes with maple syrup", Price: 7.99, Category: "desserts", PictureURL: "https://images.unsplash.com/photo-1497445702960-c21c96af4c68?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8UGFuY2FrZXN8ZW58MHx8MHx8fDA%3D"}}

	for _, item := range items {
		db.Create(&item)
	}
	fmt.Println("✅ Initial menu items added!")
}
func registerUser(w http.ResponseWriter, r *http.Request) {
	var user struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		handleError(w, http.StatusBadRequest, "Неверный формат данных", err)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		handleError(w, http.StatusInternalServerError, "Ошибка хэширования пароля", err)
		return
	}

	newUser := User{
		Name:     user.Name,
		Email:    user.Email,
		Phone:    user.Phone,
		Password: string(hashedPassword),
		Role:     "user",
	}

	if err := db.Create(&newUser).Error; err != nil {
		handleError(w, http.StatusConflict, "Ошибка регистрации: пользователь уже существует", err)
		return
	}

	logger.WithField("email", newUser.Email).Info("Пользователь успешно зарегистрирован")
	w.WriteHeader(http.StatusCreated)
}

func loginUser(w http.ResponseWriter, r *http.Request) {
	var credentials struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&credentials); err != nil {
		handleError(w, http.StatusBadRequest, "Неверный формат данных", err)
		return
	}

	var user User
	if err := db.Where("email = ?", credentials.Email).First(&user).Error; err != nil {
		handleError(w, http.StatusUnauthorized, "Пользователь не найден", err)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(credentials.Password)); err != nil {
		handleError(w, http.StatusUnauthorized, "Неверный пароль", err)
		return
	}

	logger.WithField("email", user.Email).Info("Пользователь успешно вошел в систему")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":    user.ID,
		"email": user.Email,
		"role":  user.Role,
	})
}

func handleError(w http.ResponseWriter, statusCode int, message string, err error) {
	logger.WithField("error", err).Error(message)
	http.Error(w, message, statusCode)
}
func getAllUsers(w http.ResponseWriter, r *http.Request) {
	var users []User
	if err := db.Find(&users).Error; err != nil {
		handleError(w, http.StatusInternalServerError, "Не удалось получить пользователей", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func getUserCart(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	var user User
	result := db.Where("email = ?", email).Preload("Cart").First(&user)
	if result.Error != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(user.Cart)
}
func updateUserCart(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Email string     `json:"email"`
		Cart  []FoodItem `json:"cart"`
	}
	err := json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	var user User
	result := db.Where("email = ?", data.Email).First(&user)
	if result.Error != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	db.Model(&user).Association("Cart").Replace(data.Cart)
	w.WriteHeader(http.StatusOK)
}

func getMenu(w http.ResponseWriter, r *http.Request) {
	var items []FoodItem
	db.Find(&items)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func getMenuItem(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		http.Error(w, "Invalid ID format", http.StatusBadRequest)
		return
	}
	var item FoodItem
	result := db.First(&item, id)
	if result.Error != nil {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
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
		log.Printf("Error fetching menu item with ID %d: %v", id, result.Error)
		http.Error(w, "Menu item not found", http.StatusNotFound)
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&item).Association("Orders").Clear(); err != nil {
			return err
		}
		if err := tx.Delete(&item).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		log.Printf("Error deleting menu item with ID %d: %v", id, err)
		http.Error(w, "Failed to delete menu item due to constraints", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Menu item with ID %d deleted successfully", id)
}
func getOrdersByUserID(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		http.Error(w, "userId is required", http.StatusBadRequest)
		return
	}

	var orders []Order

	result := db.Preload("FoodItems").Where("user_id = ?", userID).Find(&orders)
	if result.Error != nil {
		http.Error(w, "Failed to fetch orders", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
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
func createOrder(w http.ResponseWriter, r *http.Request) {
	var orderInput struct {
		Customer  string  `json:"customer"`
		Address   string  `json:"address"`
		Total     float64 `json:"total"`
		FoodItems []uint  `json:"food_items"` // Массив ID продуктов
	}

	if err := json.NewDecoder(r.Body).Decode(&orderInput); err != nil {
		handleError(w, http.StatusBadRequest, "Invalid order format", err)
		return
	}

	var user User
	if err := db.Where("email = ?", orderInput.Customer).First(&user).Error; err != nil {
		handleError(w, http.StatusBadRequest, "User not found", err)
		return
	}

	var foodItems []FoodItem
	if err := db.Where("id IN ?", orderInput.FoodItems).Find(&foodItems).Error; err != nil {
		handleError(w, http.StatusInternalServerError, "Failed to find food items", err)
		return
	}

	order := Order{
		Customer:  orderInput.Customer,
		Address:   orderInput.Address,
		Total:     orderInput.Total,
		FoodItems: foodItems,
		UserID:    user.ID,
	}

	if err := db.Create(&order).Error; err != nil {
		handleError(w, http.StatusInternalServerError, "Failed to create order", err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(order)
}

func getUserByEmail(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email is required", http.StatusBadRequest)
		return
	}

	var user User
	result := db.Preload("Orders.FoodItems").Where("email = ?", email).First(&user)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(user)
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
func getSupportMessages(w http.ResponseWriter, r *http.Request) {
	var messages []SupportMessage
	if err := db.Find(&messages).Error; err != nil {
		http.Error(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func main() {
	initDatabase()
	r := mux.NewRouter()
	r.HandleFunc("/menu", getMenu).Methods("GET")
	r.HandleFunc("/menu/{id}", getMenuItem).Methods("GET")
	r.HandleFunc("/menu", addMenuItem).Methods("POST")
	r.HandleFunc("/menu/{id}", deleteMenuItem).Methods("DELETE")
	r.HandleFunc("/order", placeOrder).Methods("POST")
	r.HandleFunc("/orders", getAllOrders).Methods("GET")
	r.HandleFunc("/register", registerUser).Methods("POST")
	r.HandleFunc("/login", loginUser).Methods("POST")
	r.HandleFunc("/user/cart", getUserCart).Methods("GET")
	r.HandleFunc("/user/cart", updateUserCart).Methods("POST")
	r.HandleFunc("/auth/check", checkAuth).Methods("GET")
	r.HandleFunc("/register", registerUser).Methods("POST")
	r.HandleFunc("/login", loginUser).Methods("POST")
	r.HandleFunc("/users", getAllUsers).Methods("GET")
	r.HandleFunc("/orders", createOrder).Methods("POST")
	r.HandleFunc("/users/by-email", getUserByEmail).Methods("GET")
	r.HandleFunc("/orders/by-user", getOrdersByUserID).Methods("GET")
	r.HandleFunc("/support", sendSupportMessage).Methods("POST")
	r.HandleFunc("/support/messages", getSupportMessages).Methods("GET")
	r.HandleFunc("/support/messages", getSupportMessages).Methods("GET")

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"Authorization"},
		AllowCredentials: true,
	})
	handler := c.Handler(r)

	fmt.Println("Server running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
