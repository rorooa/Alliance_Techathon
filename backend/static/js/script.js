document.addEventListener("DOMContentLoaded", function () {
    checkAuth(); // Check if user is logged in

    document.getElementById("loginForm").addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email1").value;
        const password = document.getElementById("password1").value;

        const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (data.token) {
            localStorage.setItem("token", data.token);
            alert("Login successful!");
            showDashboard();
        } else {
            alert("Login failed! Check your credentials.");
        }
    });

    document.getElementById("signupForm").addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email2").value;
        const password = document.getElementById("password2").value;

        const response = await fetch("/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (response.status === 201) {
            alert("Signup successful! Please log in.");
        } else {
            alert("Signup failed! Email might be taken.");
        }
    });

    document.getElementById("logoutBtn").addEventListener("click", function () {
        localStorage.removeItem("token");
        alert("Logged out successfully!");
        showAuthForm();
    });
});

// 🔑 Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem("token");
    token ? showDashboard() : showAuthForm();
}

// 🎯 Show dashboard after login
function showDashboard() {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    loadExpenses();
    fetchSavings();
}

// 🛑 Show login/signup form
function showAuthForm() {
    document.getElementById("auth-section").style.display = "block";
    document.getElementById("dashboard").style.display = "none";
}

// ➕ Add Expense Function
async function addExpense() {
    try {
        let response = await fetch("/add_expense", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-access-token": localStorage.getItem("token")
            },
            body: JSON.stringify({
                category: document.getElementById("category").value,
                amount: Number(document.getElementById("amount").value),
                date: document.getElementById("date").value
            })
        });

        let data = await response.json();
        if (data.message === "Expense added successfully") {
            alert("Expense added successfully!");
            loadExpenses();
            fetchSavings();
        } else {
            alert("Error adding expense.");
        }
    } catch (error) {
        console.error("Error adding expense:", error);
    }
}

// 📊 Load Expenses and Update Tables & Charts
async function loadExpenses() {
    try {
        let response = await fetch("/get_expenses", {
            headers: { "x-access-token": localStorage.getItem("token") }
        });

        let data = await response.json();
        const list = document.getElementById("expense-list");
        const dailyTable = document.getElementById("daily-expenses");
        const monthlyTable = document.getElementById("monthly-expenses");

        list.innerHTML = "";
        dailyTable.innerHTML = "";
        monthlyTable.innerHTML = "";

        let categoryTotals = {};
        let dailyTotals = {};
        let monthlyTotals = {};

        data.forEach(expense => {
            // 📝 Daily Expenses Table
            let date = new Date(expense.date).toLocaleDateString();
            if (!dailyTotals[date]) dailyTotals[date] = [];
            dailyTotals[date].push(expense);

            // 🏷️ Category Totals (For Pie Chart)
            categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;

            // 📅 Monthly Totals Table
            let month = new Date(expense.date).toLocaleString("default", { month: "long", year: "numeric" });
            monthlyTotals[month] = (monthlyTotals[month] || 0) + expense.amount;

            // 🗑️ Add Expense to List (With Delete Button)
            const li = document.createElement("li");
            li.innerHTML = `${expense.category}: $${expense.amount} 
                <button class="btn btn-danger btn-sm" onclick="deleteExpense('${expense._id}')">Delete</button>`;
            list.appendChild(li);
        });

        // ✅ Update Daily Expenses Table
        for (let date in dailyTotals) {
            let row = `<tr><td>${date}</td><td>`;
            dailyTotals[date].forEach(exp => {
                row += `${exp.category}: $${exp.amount}<br>`;
            });
            row += `</td></tr>`;
            dailyTable.innerHTML += row;
        }

        // ✅ Update Monthly Expenditure Table
        for (let month in monthlyTotals) {
            monthlyTable.innerHTML += `<tr><td>${month}</td><td>$${monthlyTotals[month]}</td></tr>`;
        }

        updatePieChart(categoryTotals);
    } catch (error) {
        console.error("Error loading expenses:", error);
    }
}

// ❌ Delete Expense Function
async function deleteExpense(expenseId) {
    try {
        let response = await fetch(`/delete_expense/${expenseId}`, {
            method: "DELETE",
            headers: { "x-access-token": localStorage.getItem("token") }
        });

        let data = await response.json();
        if (data.message === "Expense deleted successfully") {
            alert("Expense deleted successfully!");
            loadExpenses();
            fetchSavings();
        } else {
            alert("Error deleting expense.");
        }
    } catch (error) {
        console.error("Error deleting expense:", error);
    }
}

// 💰 Fetch Savings and Update Graph
async function fetchSavings() {
    try {
        let response = await fetch("/get_savings", {
            headers: { "x-access-token": localStorage.getItem("token") }
        });

        let data = await response.json();
        document.getElementById("savings").textContent = `Savings: $${data.savings}`;

        updateSavingsChart(data.savings);
    } catch (error) {
        console.error("Error fetching savings:", error);
    }
}

/* ================ CHART.JS IMPLEMENTATION ================= */

// 💹 Update Pie Chart (Expenses Breakdown)
let expenseChart;
function updatePieChart(expenseData) {
    const ctx = document.getElementById("expenseChart").getContext("2d");

    if (expenseChart) expenseChart.destroy();

    expenseChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: Object.keys(expenseData),
            datasets: [{
                label: "Expenses",
                data: Object.values(expenseData),
                backgroundColor: ["#ff6384", "#36a2eb", "#ffce56", "#4bc0c0", "#9966ff"],
                hoverOffset: 5
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// 📈 Update Line Chart (Savings Over Time)
let savingsChart;
let savingsData = [];
let days = [];

function updateSavingsChart(newSavings) {
    const ctx = document.getElementById("savingsChart").getContext("2d");

    let today = new Date().toLocaleDateString();
    if (days.length === 0 || days[days.length - 1] !== today) {
        days.push(today);
        savingsData.push(newSavings);
    } else {
        savingsData[savingsData.length - 1] = newSavings;
    }

    if (savingsChart) savingsChart.destroy();

    savingsChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: days,
            datasets: [{
                label: "Savings Over Time",
                data: savingsData,
                borderColor: "#4bc0c0",
                fill: false,
                tension: 0.1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
