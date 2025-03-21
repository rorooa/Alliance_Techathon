from flask import Flask, request, jsonify, render_template
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import pymongo
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
app.secret_key = "your_secret_key"  # Change this to a strong secret key
bcrypt = Bcrypt(app)
CORS(app)

# MongoDB setup
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["expense_manager"]
users_collection = db["users"]
expenses_collection = db["expenses"]

# Middleware to verify JWT token
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("x-access-token")
        if not token:
            return jsonify({"error": "Token is missing"}), 403
        
        try:
            data = jwt.decode(token, app.secret_key, algorithms=["HS256"])
            current_user = data["email"]
        except:
            return jsonify({"error": "Invalid token"}), 403

        return f(current_user, *args, **kwargs)

    return decorated

# Serve HTML Page
@app.route("/")
def home():
    return render_template("index.html")

# Signup Route
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
    users_collection.insert_one({"email": email, "password": hashed_password})

    return jsonify({"message": "User created successfully"}), 201

# Login Route with JWT Token
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user = users_collection.find_one({"email": email})

    if user and bcrypt.check_password_hash(user["password"], password):
        # Generate JWT token
        token = jwt.encode(
            {"email": email, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
            app.secret_key,
            algorithm="HS256"
        )
        return jsonify({"token": token}), 200  # Send token to frontend

    return jsonify({"error": "Invalid credentials"}), 401

# Protected Route to Get Expenses
@app.route("/get_expenses", methods=["GET"])
@token_required
def get_expenses(current_user):
    expenses = list(expenses_collection.find({"user_email": current_user}, {"_id": 0}))
    return jsonify(expenses)

# Protected Route to Add Expense
@app.route("/add_expense", methods=["POST"])
@token_required
def add_expense(current_user):
    data = request.json
    category = data.get("category")
    amount = data.get("amount")
    date = data.get("date")

    if not category or not amount or not date:
        return jsonify({"error": "All fields are required"}), 400

    expenses_collection.insert_one({"user_email": current_user, "category": category, "amount": amount, "date": date})

    return jsonify({"message": "Expense added successfully"}), 201

# Protected Route to Get Savings
@app.route("/get_savings", methods=["GET"])
@token_required
def get_savings(current_user):
    expenses = list(expenses_collection.find({"user_email": current_user}, {"_id": 0}))
    total_spent = sum(exp["amount"] for exp in expenses)
    savings = 5000 - total_spent  # Example calculation

    return jsonify({"savings": savings})

if __name__ == "__main__":
    app.run(debug=True)
