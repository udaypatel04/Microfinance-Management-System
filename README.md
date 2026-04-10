This is the revised, GitHub-ready **README.md**. I have removed the specific contact details and developer notes, replacing them with standard open-source instructions to help others find, fork, and contribute to your repository.

---

# FinTrack: Micro Finance Management System

**FinTrack** is a high-performance, centralized finance management platform designed to automate the lifecycle of micro-lending. Built with a "single-engine" architecture, the system manages 22 relational tables to provide secure, real-time financial services for Administrators, Operational Staff, and Customers.

---

## 🏗 System Architecture

The project is structured into three distinct operational portals, all managed via a centralized logic engine in `app.py`.

### 1. Enterprise Admin Panel
* **Master Configuration:** Manage global loan types (Gold/Bike), set dynamic interest rates, and define asset purity standards.
* **Staff Governance:** Complete lifecycle management for internal staff, including registration and profile auditing.
* **Site Control:** Toggle maintenance modes and monitor system-wide metrics.

### 2. Staff Operations Panel
* **Customer Desk:** Rapid registration and real-time updates for customer profiles and KYC status.
* **Loan Request Engine:** Dedicated workflows to search, verify, and **Approve/Reject** Gold and Bike loan applications.
* **Market Integration:** Live updates for gold prices to ensure collateral valuation (LTV) accuracy.

### 3. Customer Self-Service Portal
* **Financial Dashboard:** Live credit score tracking, active loan portfolios, and outstanding balance summaries.
* **Digital Application:** Simplified forms for Gold Loans, Bike Loans, and Bike Refinancing.
* **Repayment Suite:** Secure EMI payment tracking and instant digital receipt generation via Razorpay.

---

## 🛡 Key Innovations

* **Signature-Secured Receipts:** Publicly shareable receipts are validated using a 16-character HMAC-SHA256 digital signature to prevent tampering and forgery.
* **Infrastructure Gatekeeper:** Custom Python decorators perform health pings on the 22-table database before every route, ensuring 100% transparent uptime.
* **Price-Lock Technology:** The system saves the market price of gold/assets at the exact moment of a loan request, protecting the business from market volatility during the approval period.

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Backend** | Python (Flask) - Centralized Logic |
| **Frontend** | HTML5, Tailwind CSS, JavaScript (ES6+) |
| **Database** | MySQL (22 Normalized Tables) |
| **Integration** | Razorpay Payment Gateway |

---

## 📂 Database Schema Overview

The system utilizes a robust relational schema consisting of **22 tables** to ensure data integrity:
* **Authentication:** `admin`, `staff`, `users`, `user_details`.
* **Asset Masters:** `bike_master`, `gold_type`, `gold_purity`, `loan_type`.
* **Lending Logic:** `gold_loan_request`, `bike_loan_request`, `interest`, `gold_price`.
* **Transaction Logs:** `gold_loan_emi`, `bike_loan_emi`, `contact_inquiries`.

---

## 🏁 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### 1. Fork and Clone
1.  **Fork** the repository by clicking the "Fork" button at the top right of this page.
2.  **Clone** your forked repository:
    ```bash
    git clone https://github.com/udaypatel04/Microfinance-Management-System.git
    cd Microfinance-Management-System
    ```

### 2. Database Configuration
1.  Open **phpMyAdmin** or your preferred MySQL client.
2.  Create a new database named `finance_management`.
3.  **Import** the provided `.sql` file found in the root directory to generate the 22 tables.
4.  Update the database connection string inside `app.py` with your local MySQL credentials:
    ```python
    # Example inside app.py
    db_config = {
        'host': 'localhost',
        'user': 'root',
        'password': '',
        'database': 'finance_management'
    }
    ```

### 3. Run the Application
Ensure you have Python installed, then run the centralized application file:
```bash
python app.py
```
The server will start at `http://localhost:5000`.


## 📜 License

This project is for educational purposes only.