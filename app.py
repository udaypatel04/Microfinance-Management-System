from flask import *
import logging
import mysql.connector
from werkzeug.utils import secure_filename
import os
from flask_mail import Mail, Message # type: ignore
from threading import Thread
import time
from datetime import date,timedelta, datetime
import re
from decimal import Decimal
import requests,string,random
import razorpay # pyright: ignore[reportMissingImports]
from babel.numbers import format_currency # type: ignore
from functools import wraps
import secrets,socket
from bs4 import BeautifulSoup
import calendar
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError


from webauthn import ( # type: ignore
    generate_registration_options, verify_registration_response,
    generate_authentication_options, verify_authentication_response,
    options_to_json
)

from webauthn.helpers import base64url_to_bytes # type: ignore

from webauthn.helpers.structs import (   # type: ignore
    AuthenticatorSelectionCriteria, 
    UserVerificationRequirement, 
    ResidentKeyRequirement
)


app=Flask(__name__)


app.secret_key='fintrack'

# Cloudflare Turnstile Secret Key
SECRET_KEY = ""  # Replace with actual secret key



# Razorpay API Keys
RAZORPAY_KEY_ID = ""   # Replace with actual Razorpay Key ID
RAZORPAY_KEY_SECRET = ""   # Replace with actual Razorpay Key Secret
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# Passkey | Relying Party
RP_NAME = "FinTrack Secure"


app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = ''  # Replace with actual email
app.config['MAIL_PASSWORD'] = ''   # Replace with actual password
app.config['MAIL_DEFAULT_SENDER'] = ''  # Replace with actual sender email

mail = Mail(app)



def get_webauthn_env():
    # rp_id: The domain only (e.g., 'localhost')
   
    rp_id="localhost"
    # origin: The full URL (e.g., 'http://localhost:5000')
    # request.host automatically includes the port if it exists
    origin = f"{request.scheme}://{request.host}"
    return rp_id, origin


def get_role_config(role):
    # Maps roles to (User Table, Passkey Table, Session ID Key)
    config = {
        'admin': ('admin', 'admin_passkeys', 'admin_id'),
        'staff': ('staff', 'staff_passkeys', 'staff_id'),
        'user':  ('users', 'user_passkeys', 'user_id')
    }
    return config.get(role)


def inr_filter(value):
    return format_currency(value, 'INR', locale='en_IN')

# Add to Jinja environment
app.jinja_env.filters['inr'] = inr_filter

def inject_application_numbers(rows, context):
    prefix_map = {
        'bike loan': 'BL',
        'gold loan': 'GL',
        'verification': 'VN',
        'customer': 'CN',
        'staff': 'SN',
        'vehicle': 'VL'
    }
    prefix = prefix_map.get(context.lower(), 'LN')

    is_single = isinstance(rows, dict)
    rows = [rows] if is_single else rows
    for row in rows:
        dt = row.get('date')
        
        if not dt:
            dt = datetime.now()
        elif isinstance(dt, str):
            try:
                dt = datetime.strptime(dt, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                
                dt = datetime.now()
        
        # %H%M%S adds Hours, Minutes, and Seconds
        # Format: YYMMDD-HHMMSS
        time_str = dt.strftime('%y%m%d-%H%M%S')
        db_id = row.get('id', 0)
        
        row['app_no'] = f"{prefix}-{time_str}-{db_id}"
    
    return rows



def extract_repo_rate():
    # Using the main RBI home page as it is more stable for scraping
    url = "https://www.rbi.org.in/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Get all text from the page
        page_text = soup.get_text()
        
        # Regex to find "Policy Repo Rate" followed by the number and % sign
        match = re.search(r"Policy Repo Rate\s*:\s*(\d+\.\d+)%", page_text)
        
        if match:
            repo_rate = match.group(1)
            return repo_rate
        else:
            print("Could not find the Repo Rate on the page. Check the URL or HTML structure.")
        
    except Exception as e:
        print(f"An error occurred: {e}")



def extract_gold_price():
    url = "https://www.policybazaar.com/gold-rate/"
  
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        content = soup.get_text()
        
        import re
        match = re.search(r"1 Gram\s*₹\s*([\d,]+)", content)
        
        if match:
          
            price = match.group(1).replace(',', '')
            return int(price)
            
    except Exception as e:
        print("Error reading page")
    
    return 0 

def verify_documents(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')

        # Logic: Returns 1 if re-upload is required, 0 if verified.
        sql_query = """
            SELECT EXISTS (
                SELECT 1 FROM user_details 
                WHERE user_id = %s 
                AND (status IN ('pending', 'rejected') OR 
                DATE(updated_at) < DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
                )
            ) AS needs_reupload;
        """

        try:
           
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(sql_query, (user_id,))
            result = cursor.fetchone()

            if result and result['needs_reupload']:
                return jsonify({
                    "success": False, 
                    "message": "Please Re Upload Documents OR Wait For Verification"
                })

        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500
        finally:
            cursor.close()

        return f(*args, **kwargs)
    
    return decorated_function


def check_db_status(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            conn = get_db_connection()
            if conn.is_connected():
                conn.close()
                return f(*args, **kwargs)
        except Exception as e:
           
            return render_template('database/db_offline.html'), 503
    return decorated_function


def login_required(f):
    @check_db_status
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Multi-role check: user, admin, or staff
        is_logged_in = session.get('user_id') or session.get('admin_id') or session.get('staff_id')
        
        if not is_logged_in:
           
            return redirect(url_for('index'))
            
        return f(*args, **kwargs)
    return decorated_function


def get_transaction_time(app_no):
    
    # Check for recognized prefixes (BL, GL, VL, etc.)
    if any(app_no.upper().startswith(p) for p in ['BL-', 'GL-', 'VL-', 'VN-','SN', 'CN']):
        try:
            parts = app_no.split('-')
            # Extract Date (YYMMDD) and Time (HHMMSS)
            date_part, time_part = parts[1], parts[2]
            
            # Reconstruct to YYYY-MM-DD HH:MM:SS
            return f"20{date_part[0:2]}-{date_part[2:4]}-{date_part[4:6]} {time_part[0:2]}:{time_part[2:4]}:{time_part[4:6]}"
        except (IndexError, ValueError):
            return None
    return None

def send_async_email(app_instance, msg):
    with app_instance.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            print(f"SMTP Error: {str(e)}")

def send_fintrack_email(subject, recipient, template_path, **kwargs):
   
    msg = Message(subject, recipients=[recipient])
    
    try:
        msg.html = render_template(template_path, **kwargs)
        
        msg.body = kwargs.get('body', "Please view this email in an HTML-compatible client.")
    except Exception as e:
        print(f"Template Error: {str(e)}")
        return False

   
    app_instance = current_app._get_current_object()
    
    Thread(target=send_async_email, args=(app_instance, msg)).start()
    return True
  

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="finance_management"
    )


def get_user_reliability_discount():
    customer_id = session.get('user_id')
    if not customer_id:
        return 0.0

    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = """
        SELECT 
            IFNULL(SUM(total_paid_count), 0) as total_completed,
            IFNULL(SUM(on_time_count), 0) as total_on_time
        FROM (
            SELECT 
                COUNT(*) as total_paid_count,
                SUM(CASE WHEN emi_date <= due_date THEN 1 ELSE 0 END) as on_time_count
            FROM bike_loan_emi 
            WHERE status = 'paid' 
              AND bike_loan_request_id IN (SELECT id FROM bike_loan_request WHERE customer_id = %s)
            
            UNION ALL
            
            SELECT 
                COUNT(*) as total_paid_count,
                SUM(CASE WHEN emi_date <= due_date THEN 1 ELSE 0 END) as on_time_count
            FROM gold_loan_emi 
            WHERE status = 'paid' 
              AND gold_loan_request_id IN (SELECT id FROM gold_loan_request WHERE customer_id = %s)
        ) as combined_stats;
        """

        cursor.execute(query, (customer_id, customer_id))
        result = cursor.fetchone()
        
        total_completed = result['total_completed']
        on_time_emi = result['total_on_time']
        
        # Minimum 12 installments check
        if total_completed < 12:
            return 0.0

        reliability_pc = (on_time_emi / total_completed) * 100
        
        # --- REWARD & PENALTY LOGIC ---
        
        #  Rewards (Discounts)
        if reliability_pc == 100:
            return -0.50  # Subtract from base rate
        elif reliability_pc >= 90:
            return -0.30
        elif reliability_pc >= 80:
            return -0.20
            
        # Standard Zone
        elif reliability_pc >= 50:
            return 0.0
            
        # Penalty Zone (Reliability < 50%)
        elif reliability_pc >= 30:
            return 0.50   # Add to base rate
        else:
            return 1.00   # Critical risk surcharge
            
    except Exception as e:
        print(f"Database Error: {e}")
        return 0.0

    finally:
        if cursor: cursor.close()
        if conn: conn.close()

def get_digital_signature():
  return secrets.token_hex(16) 

def get_system_ip_address():
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    return local_ip

def generate_payment_receipt_id(loan_type, payment_id):
    now = datetime.now()
    
    # %y%m%d -> Date (260322)
    # %H%M%S -> Time (191553)
    timestamp = now.strftime("%y%m%d-%H%M%S")
    
    type_code = "GL" if "gold loan" in loan_type.lower() else "BL"
    
   
    sequence = str(payment_id).zfill(4)
    
    return f"FT-{timestamp}-{type_code}-{sequence}"

 

# Razorpay Payment
@app.route('/create-payment-order', methods=['POST'])
@login_required
def create_order():
    data = request.get_json()
    amount = int(data.get('amount') * 100) # Razorpay expects amount in Paise (x100)

    # Create Order in Razorpay
    order_data = {
        'amount': amount,
        'currency': 'INR',
        'payment_capture': 1
    }
    
    order = client.order.create(data=order_data)
    
    return jsonify({
        "success": True,
        "order_id": order['id'],
        "amount": amount
    })



@app.route('/verify-payment', methods=['POST'])
@login_required
def verify_payment():
    data = request.get_json()
    conn = None
    
    # 1. Prepare Razorpay Data
    params_dict = {
        'razorpay_order_id': data.get('razorpay_order_id'),
        'razorpay_payment_id': data.get('razorpay_payment_id'),
        'razorpay_signature': data.get('razorpay_signature'),
    }
    walletTransctionId = data.get('walletTransctionId')
    loan_type = data.get('loan_type')
    installment_no = data.get('installment_no')
    total_payable = data.get('totalPayable')

    try:
        # 2. Signature Verification
        client.utility.verify_payment_signature(params_dict)

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Fetch user info for the email alert
        cursor.execute("SELECT full_name, email FROM users WHERE id = %s", (session.get('user_id'),))
        user_info = cursor.fetchone()
        
        walletPaymentId = None
        if walletTransctionId:
           cursor.execute("SELECT payment_id FROM wallet_transaction WHERE id = %s", (walletTransctionId,))
           walletPaymentId = cursor.fetchone()['payment_id']
           
        # --- 3. DATABASE LOGIC (GOLD & BIKE) ---
        if loan_type in ['gold loan', 'bike loan']:
            table_prefix = "gold" if loan_type == 'gold loan' else "bike"
            
            # Get Loan Info
            cursor.execute(f'SELECT monthly_emi AS emi_amount, expected_month AS total_installments FROM {table_prefix}_loan_request WHERE id=%s', (data.get('loan_request_id'),))
            result = cursor.fetchone()
            emi_amount = result['emi_amount']
            total_installments = result['total_installments']

            # Record Razorpay Transaction
            cursor.execute("INSERT INTO razorpay_transaction(amount, razorpay_payment_id, digital_signature) VALUES (%s, %s, %s)",
                           (total_payable, data.get('razorpay_payment_id'), get_digital_signature()))
            razorpay_transaction_id = cursor.lastrowid

            # Record EMI Payment (Handles Split or Full Online)
            insert_sql = f"""
                INSERT INTO {table_prefix}_loan_emi 
                ( {table_prefix}_loan_request_id, due_date, installment_no, emi_amount, late_fee, 
                emi_date, emi_time, status, razorpay_transaction_id {', wallet_transaction_id' if walletTransctionId else ''})
                VALUES (%s, %s, %s, %s, %s, CURDATE(), CURTIME(), 'paid', %s {', %s' if walletTransctionId else ''})
            """
            
            val_tuple = (data.get('loan_request_id'), data.get('due_date'), installment_no, emi_amount, data.get('late_fee', 0), razorpay_transaction_id)
            if walletTransctionId: val_tuple += (walletTransctionId,)
            
            cursor.execute(insert_sql, val_tuple)

            # Check for Loan Completion
            cursor.execute(f"SELECT COUNT(installment_no) AS paid FROM {table_prefix}_loan_emi WHERE {table_prefix}_loan_request_id=%s", (data.get('loan_request_id'),))
            if cursor.fetchone()['paid'] == total_installments:
                cursor.execute(f'UPDATE {table_prefix}_loan_request SET customer_status="inactive" WHERE id=%s', (data.get('loan_request_id'),))
            
            conn.commit()

        # --- 4. FIRE-AND-FORGET TRANSACTION ALERT ---
        if user_info:
            type_label = "Split Payment (Wallet + Online)" if walletTransctionId else "Full Online Payment"
            formatted_amount = "{:,.2f}".format(float(total_payable))
            try:
                    msg = Message(
                        subject=f"Transaction Alert: ₹{emi_amount} Paid for {loan_type.capitalize()} EMI",
                        sender=app.config['MAIL_USERNAME'],
                        recipients=[user_info['email']]
                    )
                    msg.html = render_template(
                        'email/sendEMITransactionAlert.html',
                        full_name=user_info['full_name'],
                        loan_type=loan_type.capitalize(),
                        installment_no=installment_no,
                        amount=emi_amount,
                        payment_id=data.get('razorpay_payment_id'),
                        wallet_payment_id=walletPaymentId if walletPaymentId else "N/A",
                        trans_type=type_label,
                        date=datetime.now().strftime('%d-%b-%Y %H:%M:%S')
                    )
                    
                    # Start the background thread
                    Thread(target=send_async_email, args=(app, msg)).start()
            except Exception as e:
                print(f"Failed to send email: {str(e)}")        

        return jsonify({"success": True, "message": f"{loan_type.capitalize()} payment successful!"}), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()




# Wallet Payment

@app.route('/pay-emi-via-wallet', methods=['POST'])
@login_required
def pay_emi_via_wallet():
    data = request.get_json()
    user_id = session.get('user_id')
    conn = None
    
    # Extract variables
    loan_type = data.get('loan_type')
    loan_request_id = data.get('loan_request_id')
    total_payable = data.get('amount')
    installment_no = data.get('installment_no')
    due_date = data.get('due_date')
    late_fee = data.get('late_fee', 0)

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 1. Fetch User Info for Email Alert
        cursor.execute("SELECT full_name, email FROM users WHERE id = %s", (user_id,))
        user_info = cursor.fetchone()

        # 2. Wallet Validation & Deduction
        cursor.execute("SELECT id, balance FROM digital_wallet WHERE customer_id = %s", (user_id,))
        wallet = cursor.fetchone()
        
        if not wallet or wallet['balance'] < total_payable:
            return jsonify({"success": False, "message": "Insufficient wallet balance"}), 400
        
        wallet_id = wallet['id']

        # Update Wallet Balance
        cursor.execute("UPDATE digital_wallet SET balance = balance - %s WHERE id = %s", (total_payable, wallet_id))
        
        # Generate Internal Wallet Payment ID
        internal_pay_id = f"WLT_EMI_{int(loan_request_id):05d}_{int(installment_no):05d}"
        
        # Log Wallet Transaction
        cursor.execute("""
            INSERT INTO wallet_transaction (wallet_id, amount, payment_id, trans_type, digital_signature, created_at, payment_time)
            VALUES (%s, %s, %s, 'debit', %s, CURDATE(), CURTIME())
        """, (wallet_id, total_payable, internal_pay_id, get_digital_signature()))
        
        wallet_transaction_id = cursor.lastrowid

        # --- 3. DYNAMIC LOAN LOGIC (GOLD & BIKE) ---
        if loan_type in ['gold loan', 'bike loan']:
            table_prefix = "gold" if loan_type == 'gold loan' else "bike"
            
            # Fetch EMI details
            cursor.execute(f'SELECT monthly_emi AS emi_amount, expected_month AS total_installments FROM {table_prefix}_loan_request WHERE id=%s', (loan_request_id,))
            loan_result = cursor.fetchone()
            emi_amount = loan_result['emi_amount']
            total_installments = loan_result['total_installments']

            # Record EMI Payment (100% Wallet)
            insert_sql = f"""
                INSERT INTO {table_prefix}_loan_emi 
                ({table_prefix}_loan_request_id, due_date, installment_no, emi_amount, late_fee, 
                emi_date, emi_time, status, wallet_transaction_id)
                VALUES (%s, %s, %s, %s, %s, CURDATE(), CURTIME(), 'paid', %s)
            """
            cursor.execute(insert_sql, (loan_request_id, due_date, installment_no, emi_amount, late_fee, wallet_transaction_id))

            # Check for Loan Completion
            cursor.execute(f"SELECT COUNT(installment_no) AS paid FROM {table_prefix}_loan_emi WHERE {table_prefix}_loan_request_id=%s", (loan_request_id,))
            if cursor.fetchone()['paid'] == total_installments:
                cursor.execute(f'UPDATE {table_prefix}_loan_request SET customer_status="inactive" WHERE id=%s', (loan_request_id,))
            
            conn.commit()

            # --- 4. ASYNC TRANSACTION ALERT ---
            if user_info:
                formatted_amount = "{:,.2f}".format(float(total_payable))
                try:
                    msg = Message(
                        subject=f"Wallet Debit Alert: ₹{formatted_amount} Paid for {loan_type.capitalize()} EMI",
                        sender=app.config['MAIL_USERNAME'],
                        recipients=[user_info['email']]
                    )
                    # Using the Wallet specific template  created
                    msg.html = render_template(
                        'email/sendWalletTransactionAlert.html',
                        full_name=user_info['full_name'],
                        loan_type=loan_type.capitalize(),
                        installment_no=installment_no,
                        amount=formatted_amount,
                        wallet_tid=internal_pay_id,
                        trans_type="Full Wallet Payment",
                        date=datetime.now().strftime('%d-%b-%Y %H:%M:%S')
                    )
                    
                    # Offload email sending to background thread
                    Thread(target=send_async_email, args=(app, msg)).start()
                except Exception as mail_err:
                    print(f"Failed to prepare wallet alert: {str(mail_err)}")

            return jsonify({
                "success": True, 
                "message": f"{loan_type.capitalize()} EMI paid via wallet",
                "wallet_transaction_id": wallet_transaction_id
            }), 200

        else:
            return jsonify({"success": False, "message": "Invalid loan type"}), 400

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()



# Split EMI Payment          

@app.route('/initiate-split-wallet-deduction', methods=['POST'])
@login_required
def initiate_split_wallet_deduction():
    data = request.get_json()
    user_id = session.get('user_id')
    conn = None
    
    # Extract variables
    wallet_contribution = int(data.get('wallet_contribution'))
    loan_request_id = int(data.get('loan_request_id'))
    installment_no = int(data.get('installment_no'))
   
    loan_type = data.get('loan_type', 'EMI Payment')

    if wallet_contribution is None or wallet_contribution <= 0:
        return jsonify({"success": False, "message": "Invalid amount"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 1. Fetch User Info for the Alert
        cursor.execute("SELECT full_name, email FROM users WHERE id = %s", (user_id,))
        user_info = cursor.fetchone()

        # 2. Wallet Logic
        cursor.execute("SELECT id, balance FROM digital_wallet WHERE customer_id = %s", (user_id,))
        wallet = cursor.fetchone()
        
        if not wallet or wallet['balance'] < wallet_contribution:
            return jsonify({"success": False, "message": "Insufficient balance"}), 400
        
        wallet_id = wallet['id']
        cursor.execute("UPDATE digital_wallet SET balance = balance - %s WHERE id = %s", (wallet_contribution, wallet_id))
        
        internal_pay_id = f"SPLIT_WLT_{int(loan_request_id):05d}_{int(installment_no):05d}"
        
        insert_wallet_trans = """
            INSERT INTO wallet_transaction (wallet_id, amount, payment_id, trans_type, digital_signature, created_at, payment_time)
            VALUES (%s, %s, %s, 'debit', %s, CURDATE(), CURTIME())
        """
        
        cursor.execute(insert_wallet_trans, (
            wallet_id, 
            wallet_contribution, 
            internal_pay_id, 
            get_digital_signature()
        ))
        
        wallet_transaction_id = cursor.lastrowid
        
        # Commit the transaction so funds are officially deducted
        conn.commit()

        # --- 3. ASYNC TRANSACTION ALERT ---
        if user_info:
            formatted_amount = "{:,.2f}".format(float(wallet_contribution))
            try:
                msg = Message(
                    subject=f"Wallet Debit Alert: ₹{formatted_amount} for Split Payment",
                    sender=app.config['MAIL_USERNAME'],
                    recipients=[user_info['email']]
                )
                
                msg.html = render_template(
                    'email/sendWalletTransactionAlert.html',
                    full_name=user_info['full_name'],
                    loan_type=loan_type.capitalize(),
                    installment_no=installment_no,
                    amount=formatted_amount,
                    wallet_tid=internal_pay_id,
                    trans_type="Split Payment (Wallet Portion)",
                    date=datetime.now().strftime('%d-%b-%Y %H:%M:%S')
                )
                
                # Fire the background thread
                Thread(target=send_async_email, args=(app, msg)).start()
            except Exception as mail_err:
                print(f"Failed to prepare split wallet alert: {str(mail_err)}")

        return jsonify({
            "success": True, 
            "wallet_transaction_id": wallet_transaction_id,
        }), 200

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
        
    finally:
        if conn:
            cursor.close()
            conn.close()



@app.route('/revert-wallet-deduction', methods=['POST'])
@login_required
def revert_wallet_deduction():
    data = request.get_json()
    wallet_trans_id = data.get('wallet_transaction_id')
    user_id = session.get('user_id')
    conn = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 1. Fetch User Info for the alert
        cursor.execute("SELECT full_name, email FROM users WHERE id = %s", (user_id,))
        user_info = cursor.fetchone()

        # 2. Verify original debit exists and get details
        cursor.execute("""
            SELECT wt.amount, wt.wallet_id, wt.payment_id 
            FROM wallet_transaction wt
            JOIN digital_wallet dw ON wt.wallet_id = dw.id
            WHERE wt.id = %s AND dw.customer_id = %s AND wt.trans_type = 'debit'
        """, (wallet_trans_id, user_id))
        
        orig_txn = cursor.fetchone()

        if orig_txn:
            # 3. Restore Wallet Balance
            cursor.execute("UPDATE digital_wallet SET balance = balance + %s WHERE id = %s", 
                           (orig_txn['amount'], orig_txn['wallet_id']))

            # 4. Insert Reversal Transaction Record
            revert_payment_id = f"REV-{orig_txn['payment_id']}"
            cursor.execute("""
                INSERT INTO wallet_transaction 
                (wallet_id, amount, payment_id, trans_type, digital_signature, created_at, payment_time)
                VALUES (%s, %s, %s, 'revert', %s, CURDATE(), CURTIME())
            """, (orig_txn['wallet_id'], orig_txn['amount'], revert_payment_id, get_digital_signature()))
            
            conn.commit()

            # --- 5. ASYNC REVERSAL ALERT ---
            if user_info:
                formatted_amount = "{:,.2f}".format(float(orig_txn['amount']))
                try:
                    msg = Message(
                        subject=f"Reversal Alert: ₹{formatted_amount} Restored to Wallet",
                        sender=app.config['MAIL_USERNAME'],
                        recipients=[user_info['email']]
                    )
                    
                    msg.html = render_template(
                        'email/sendWalletRefundAlert.html', # Reusing  wallet template
                        full_name=user_info['full_name'],
                        loan_type="Payment Reversal",
                        installment_no="N/A",
                        amount=formatted_amount,
                        wallet_tid=revert_payment_id,
                        trans_type="Wallet Balance Restored (Refund)",
                        date=datetime.now().strftime('%d-%b-%Y %H:%M:%S')
                    )
                    
                    # Offload to background thread
                    Thread(target=send_async_email, args=(app, msg)).start()
                except Exception as mail_err:
                    print(f"Failed to prepare reversal alert: {str(mail_err)}")

            return jsonify({"success": True, "message": "Transaction reverted and balance restored."}), 200
        
        return jsonify({"success": False, "message": "Original transaction not found."}), 404

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()



@app.route('/create-wallet-order', methods=['POST'])
@login_required
def create_wallet_order():
    user_id = session.get('user_id')
    data = request.get_json()
    load_amount = float(data.get('amount', 0))
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Fetch current balance and EMI-based limit
        emi_query = """
        SELECT 
            (SELECT IFNULL(balance, 0) FROM digital_wallet WHERE customer_id = %s) as current_balance,
            ((SELECT IFNULL(SUM(monthly_emi), 0) FROM bike_loan_request WHERE customer_id = %s AND status = 'approved' AND customer_status='active') +
             (SELECT IFNULL(SUM(monthly_emi), 0) FROM gold_loan_request WHERE customer_id = %s AND status = 'approved' AND customer_status='active')) * 3 
            as max_limit
        """
        cursor.execute(emi_query, (user_id, user_id, user_id))
        limits = cursor.fetchone()
        
        current_balance = float(limits['current_balance'])
        # Fallback limit of 5000 if no active loans
        max_limit = float(limits['max_limit']) if limits['max_limit'] > 0 else 5000.00
        
        # 2. Server-side Limit Validation
        if (current_balance + load_amount) > max_limit:
            return jsonify({
                "success": False, 
                "message": f"Transaction denied. Total balance cannot exceed ₹{max_limit:,.2f}"
            }), 400

        # 3. Create Order in Razorpay (Amount in Paise)
        paise_amount = int(load_amount * 100)
        order_data = {
            'amount': paise_amount,
            'currency': 'INR',
            'payment_capture': 1,
            'notes': {
                'type': 'wallet_topup',
                'customer_id': user_id
            }
        }
        
        razorpay_order = client.order.create(data=order_data)
        
        return jsonify({
            "success": True,
            "order_id": razorpay_order['id'],
            "amount": paise_amount
        })

    except Exception as e:
        print(f"Wallet Order Error: {e}")
        return jsonify({"success": False, "message": "Could not initiate payment"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/verify-wallet-payment', methods=['POST'])
@login_required
def verify_wallet_payment():
    data = request.get_json()
    user_id = session.get('user_id')
    conn = None
    
    params_dict = {
        'razorpay_order_id': data.get('razorpay_order_id'),
        'razorpay_payment_id': data.get('razorpay_payment_id'),
        'razorpay_signature': data.get('razorpay_signature')
    }

    try:
        # 1. Verify Razorpay Signature (Keep this outside DB logic)
        client.utility.verify_payment_signature(params_dict)

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # --- FIX: Start Transaction BEFORE any SELECT statements ---
        conn.start_transaction()

        # 2. Fetch User Info for Email
        cursor.execute("SELECT full_name, email FROM users WHERE id = %s", (user_id,))
        user_info = cursor.fetchone()

        # 3. Get Wallet ID
        cursor.execute("SELECT id, balance FROM digital_wallet WHERE customer_id = %s", (user_id,))
        wallet = cursor.fetchone()
        
        if not wallet:
            conn.rollback() # Always rollback if exit early
            return jsonify({"success": False, "message": "Wallet not found"}), 404
        
        wallet_id = wallet['id']
        load_amount = float(data.get('amount'))

        # 4. Update Balance
        cursor.execute("UPDATE digital_wallet SET balance = balance + %s WHERE id = %s", (load_amount, wallet_id))

        # 5. Log Transaction
        cursor.execute("""
            INSERT INTO wallet_transaction 
            (wallet_id, amount, payment_id, trans_type, digital_signature, created_at, payment_time) 
            VALUES (%s, %s, %s, 'credit', %s, CURDATE(), CURTIME())
        """, (wallet_id, load_amount, data.get('razorpay_payment_id'), get_digital_signature()))

        # 6. Commit everything at once
        conn.commit()

        # --- 7. ASYNC EMAIL ALERT (Happens after commit) ---
        if user_info:
            formatted_amount = "{:,.2f}".format(load_amount)
            try:
                msg = Message(
                    subject=f"Wallet Credit Alert: ₹{formatted_amount} Added Successfully",
                    sender=app.config['MAIL_USERNAME'],
                    recipients=[user_info['email']]
                )
                msg.html = render_template('email/sendWalletTopupAlert.html', 
                                         full_name=user_info['full_name'], 
                                         amount=formatted_amount, 
                                         payment_id=data.get('razorpay_payment_id'), 
                                         date=datetime.now().strftime('%d-%b-%Y %H:%M:%S'))
                Thread(target=send_async_email, args=(app, msg)).start()
            except Exception as mail_err:
                print(f"Mail Preparation Error: {mail_err}")

        return jsonify({"success": True, "message": f"₹{load_amount} successfully added."}), 200

    except Exception as e:
        if conn:
            conn.rollback() # This cleans up the "Transaction in progress" state
        print(f"Verification Error: {e}")
        return jsonify({"success": False, "message": "Transaction failed or signature mismatch"}), 400
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/generate-receipt-view/<loan_type>', methods=['POST'])
@login_required 
def view_loan_receipt(loan_type):
    data = request.get_json()
    loan_id = data.get('loan_request_id')
    inst_no = data.get('installment_no')
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # --- 1. SEPARATE LOGIC PER LOAN TYPE ---
        if loan_type == 'gold-loan':
            display_title = "GOLD LOAN"
            loan_label = 'gold loan'
            query = """
                SELECT 
                    e.*, r.*, 
                    u.full_name AS customer_name, u.email, u.mobile_number AS phone_number,
                    rt.amount AS razor_amount, rt.razorpay_payment_id, rt.digital_signature AS razor_sig,
                    wt.amount AS wallet_amount, wt.payment_id AS wallet_payment_id, wt.digital_signature AS wallet_sig
                FROM gold_loan_emi e
                JOIN gold_loan_request r ON e.gold_loan_request_id = r.id
                JOIN users u ON r.customer_id = u.id
                LEFT JOIN razorpay_transaction rt ON e.razorpay_transaction_id = rt.id
                LEFT JOIN wallet_transaction wt ON e.wallet_transaction_id = wt.id
                WHERE e.gold_loan_request_id = %s AND e.installment_no = %s
            """
        else:
            display_title = "BIKE LOAN"
            loan_label = 'bike loan'
            query = """
                SELECT 
                    e.*, r.*, 
                    u.full_name AS customer_name, u.email, u.mobile_number AS phone_number,
                    rt.amount AS razor_amount, rt.razorpay_payment_id, rt.digital_signature AS razor_sig,
                    wt.amount AS wallet_amount, wt.payment_id AS wallet_payment_id, wt.digital_signature AS wallet_sig
                FROM bike_loan_emi e
                JOIN bike_loan_request r ON e.bike_loan_request_id = r.id
                JOIN users u ON r.customer_id = u.id
                LEFT JOIN razorpay_transaction rt ON e.razorpay_transaction_id = rt.id
                LEFT JOIN wallet_transaction wt ON e.wallet_transaction_id = wt.id
                WHERE e.bike_loan_request_id = %s AND e.installment_no = %s
            """

        cursor.execute(query, (loan_id, inst_no))
        payment = cursor.fetchone()

        if not payment:
            return jsonify({"success": False, "message": "Transaction record not found"}), 404
        
        # --- 2. DATA NORMALIZATION & TOTALS ---
        # Convert DB values to floats and handle None (from LEFT JOINs)
        razor_amt = float(payment.get('razor_amount') or 0)
        wallet_amt = float(payment.get('wallet_amount') or 0)
        
        payment['total_paid_amount'] = razor_amt + wallet_amt
        payment['razor_amount'] = razor_amt
        payment['wallet_amount'] = wallet_amt
        payment['emi_amount'] = float(payment.get('emi_amount') or 0)
        payment['late_fee'] = float(payment.get('late_fee') or 0)
        
        # Helper functions for receipt metadata
        payment['app_no'] = inject_application_numbers(payment, loan_label)[0]['app_no']
        payment['receipt_no'] = generate_payment_receipt_id(loan_label, payment['installment_no'])
        payment['system_ip_address'] = get_system_ip_address()

        # --- 3. RENDER RECEIPT ---
        return render_template(
            'pdf/receipt_pdf_template.html', 
            payment=payment, 
            loan_type=display_title
        )

    except Exception as e:
        print(f"Receipt Generation Error: {str(e)}")
        return f"Internal Server Error: {str(e)}", 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/verify-payment/<app_no>/<int:inst_no>')
def verify_payment_public(app_no, inst_no):
    # 1. Get Query Parameters from the URL (?rzp=...&wlt=...&s=...)
    rzp_id = request.args.get('rzp')
    wlt_id = request.args.get('wlt')
    signature_param = request.args.get('s')

    # 2. Identify Table based on Application Number Prefix
    if app_no.startswith('GL-'):
        emi_table, req_table, fk_col, category = "gold_loan_emi", "gold_loan_request", "gold_loan_request_id", "Gold Loan"
    elif app_no.startswith('BL-'):
        emi_table, req_table, fk_col, category = "bike_loan_emi", "bike_loan_request", "bike_loan_request_id", "Bike Loan"
    else:
        return render_template('pdf/public_verify_error.html', message="Invalid Loan Prefix"), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 3. Query joins EMI record with both potential transaction sources
        query = f"""
            SELECT 
                e.*, u.full_name,u.email, u.mobile_number AS phone, 
                rt.amount AS razor_amt, rt.digital_signature AS razor_sig,
                wt.amount AS wallet_amt, wt.digital_signature AS wallet_sig
            FROM {emi_table} e
            JOIN {req_table} r ON e.{fk_col} = r.id
            JOIN users u ON r.customer_id = u.id
            LEFT JOIN razorpay_transaction rt ON e.razorpay_transaction_id = rt.id
            LEFT JOIN wallet_transaction wt ON e.wallet_transaction_id = wt.id
            WHERE e.installment_no = %s 
            AND (rt.razorpay_payment_id = %s OR wt.payment_id = %s)
        """
        cursor.execute(query, (inst_no, rzp_id, wlt_id))
        payment = cursor.fetchone()

        if not payment:
            return render_template('pdf/public_verify_error.html', message="Record not found"), 404

        # 4. Signature Verification Logic
        # We recreate the combined signature string to compare with 's' parameter
        db_razor_sig = (payment['razor_sig'][:8] if payment['razor_sig'] else "")
        db_wallet_sig = (payment['wallet_sig'][:8] if payment['wallet_sig'] else "")
        combined_db_sig = db_razor_sig + db_wallet_sig
        payment['combined_db_sig']=combined_db_sig
        if signature_param != combined_db_sig:
            return render_template('pdf/public_verify_error.html', message="Security Alert: Digital Signature Mismatch"), 403

        # 5. Success - Prepare data for "Verified" Page
        payment['app_no'] = app_no
        payment['total_paid'] = float(payment.get('razor_amt') or 0) + float(payment.get('wallet_amt') or 0)
        
        return render_template('pdf/public_verified_receipt.html', 
                               payment=payment, 
                               loan_type=category)

    except Exception as e:
        print(e)
        return render_template('pdf/public_verify_error.html'), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/verify-user', methods=['POST'])
def process_login():
    # Capture the token and the user's IP address    
    token = request.form.get('cf-turnstile-response')
    user_ip = request.remote_addr 
    
    if not token:
        return jsonify({"status": "error", "msg": "Missing verification token"}), 400

    # Verify with Cloudflare
    try:
        verify_response = requests.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={
                'secret': SECRET_KEY, 
                'response': token,
                'remoteip': user_ip # Recommended for better bot detection
            },
            timeout=5 # Prevent the app from hanging
        )
        
        result = verify_response.json()

        if result.get('success'):   
            return jsonify({"status": "success", "msg": "Login Authorized"})
        else:
            return jsonify({
                "status": "error", 
                "msg": "Verification Failed",
                "errors": result.get('error-codes') # Useful for debugging
            }), 403

    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "msg": "Internal verification error"}), 500

@app.route('/')
@check_db_status
def index():
    try:
        conn = get_db_connection()
     
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute("SELECT * FROM site_settings WHERE id = 1 LIMIT 1")
            result = cursor.fetchone()
        
        
        if not result:
            return render_template(
                'index.html', 
                settings={}, 
                message="Settings not configured", 
                success=False
            )
        print(result["maintenance_mode"])
        if result["maintenance_mode"]==1:
            return render_template('maintenanceMode.html',settings=result) 
        
        return render_template('index.html', settings=result, success=True)

    except Exception as e:
       
        return render_template(
            'index.html', 
            settings={}, 
            message=f"Database Error: {str(e)}", 
            success=False
        )

    finally:
        
        if  conn:
            conn.close()
   

@app.route('/submit-inquiry', methods=['POST'])
def submit_inquiry():
    conn = None
    try:
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        message = request.form.get('message', '').strip()

        if not name or not email or not message:
            return jsonify({
                "success": False, 
                "message": "All Fields Are Required"
            })

        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "INSERT INTO contact_inquiries (full_name, email, message_body) VALUES (%s, %s, %s)"
            cursor.execute(sql, (name, email, message))
            conn.commit()
            
        return jsonify({
            "success": True, 
            "message": "Inquiry Submitted Successfully"
        })

    except Exception as e:
        if  conn:
            conn.rollback()
        return jsonify({
            "success": False, 
            "message": f"Database Error: {str(e)}"
        })
        
    finally:
        if  conn:
            conn.close()


# admin | satff | user Login


@app.route('/login', methods=['POST'])
def login():
    conn = None
    try:
        data = request.get_json()
        role = data.get('role')
        email = data.get('email')
        password = data.get('password') # The plain text from the user
        
        ph = PasswordHasher()
        conn = get_db_connection()
        
        with conn.cursor(dictionary=True) as cursor:
            # 1. Map roles to table names to keep the code clean
            role_table_map = {
                'admin': 'admin',
                'staff': 'staff',
                'user': 'users'
            }
            
            table = role_table_map.get(role)
            if not table:
                return jsonify({"success": False, "message": "Invalid role"})

          
            query = f"SELECT * FROM {table} WHERE email = %s"
            cursor.execute(query, (email,))
            result = cursor.fetchone()

            if result:
                try:
                 
                    ph.verify(result['password'], password)
                    
                  
                    has_passkey = False
                    passkey_table = f"{role}_passkeys" if role != 'user' else "user_passkeys"
                    id_col = f"{role}_id"
                    
                    cursor.execute(f"SELECT id FROM {passkey_table} WHERE {id_col} = %s", (result['id'],))
                    if cursor.fetchone():
                        has_passkey = True

                   
                    img_folder = 'users' if role == 'user' else role
                    img_path = f"/static/uploads/{img_folder}/profiles/{result['profile_image'] or f'default-{role}-image.png'}"
                    
                 
                    session_data = {
                        'role': role,
                        'email': result['email'],
                        'profile_image': img_path,
                        'has_passkey': has_passkey
                    }
                    
                    if role == 'admin':
                        session_data['admin_id'] = result['id']
                    elif role == 'staff':
                        session_data.update({'staff_id': result['id'], 'staff_name': result['full_name'], 'is_temp': result['is_temporary']})
                    else:
                        session_data.update({
                            'user_id': result['id'], 'user_name': result['full_name'], 'mobile': result['mobile_number'],
                            'gender': result['gender'], 'dob': result['dob'].strftime('%Y-%m-%d'), 'city': result['city'],
                            'address': result['address'], 'is_temp': result['is_temp']
                        })
                    
                    session.update(session_data)
                    return jsonify({"success": True, "url": f"/{role}-dashboard"})

                except VerifyMismatchError:
                    # Password did not match
                    return jsonify({"success": False, "message": "Invalid Credentials"})

            return jsonify({"success": False, "message": "Invalid Credentials"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()



@app.route('/register-passkey-options', methods=['POST'])
@login_required
def register_passkey_options():
    try:
        role = session.get('role')
        _, _, id_key = get_role_config(role)
        
        user_id = session.get(id_key)
        rp_id, _ = get_webauthn_env()
        
        # PREPEND THE ROLE TO THE ID
        # Example: "1" becomes "staff_1"
        unique_user_id = f"{role}_{user_id}"

        options = generate_registration_options(
            rp_id=rp_id,
            rp_name="FinTrack Secure",
            user_id=unique_user_id.encode('utf-8'),
            user_name=session.get('email'),
            user_display_name=session.get('user_name') or session.get('staff_name') or "Admin",
            authenticator_selection=AuthenticatorSelectionCriteria(
                user_verification=UserVerificationRequirement.REQUIRED,
                resident_key=ResidentKeyRequirement.REQUIRED
            )
        )
        
        session['reg_challenge'] = options.challenge
        return jsonify({"success": True, "options": json.loads(options_to_json(options))})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/register-passkey-verify', methods=['POST'])
@login_required
def register_passkey_verify():
    conn = None
    try:
        data = request.get_json()
        role = session.get('role')
        _, passkey_table, id_key = get_role_config(role)
        user_id = session.get(id_key)
        
        # 1. Standard WebAuthn Verification
        rp_id, origin = get_webauthn_env()
        verify_reg = verify_registration_response(
            credential=data,
            expected_challenge=session.pop('reg_challenge'),
            expected_origin=origin, 
            expected_rp_id=rp_id
        )

        conn = get_db_connection()
       
        cursor = conn.cursor(dictionary=True) 

        # --- THE SECURITY CHECK: Does this ID already have a key? ---
        check_query = f"SELECT id FROM {passkey_table} WHERE {id_key} = %s"
        cursor.execute(check_query, (user_id,))
        existing_key = cursor.fetchone()

        if existing_key:
            return jsonify({
                "success": False, 
                "message": "Security Error: A device is already linked to this account. Remove it first to link a new one."
            }), 409  # 409 Conflict

        # --- Proceed with Insertion if no key exists ---
        query = f"""
            INSERT INTO {passkey_table} 
            ({id_key}, credential_id, public_key, sign_count) 
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(query, (
            user_id, 
            verify_reg.credential_id, 
            verify_reg.credential_public_key, 
            verify_reg.sign_count
        ))
        conn.commit()

        session['has_passkey'] = True
        return jsonify({"success": True, "message": "Biometric security linked!"})

    except Exception as e:
        print(f"Registration Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        
        
# --- 3. LOGIN OPTIONS ---
@app.route('/login-passkey-options', methods=['POST'])
def login_passkey_options():
    rp_id, _ = get_webauthn_env()
    
    options = generate_authentication_options(
        rp_id=rp_id,
        user_verification=UserVerificationRequirement.REQUIRED 
    )
    session['auth_challenge'] = options.challenge
    return jsonify({
        "success": True,
        "options": json.loads(options_to_json(options))
    })


# --- 4. LOGIN VERIFY ---
@app.route('/login-passkey-verify', methods=['POST'])
def login_passkey_verify():
    conn = None
    try:
        data = request.get_json()
        role = data.get('role') # From JS
        user_table, passkey_table, id_key = get_role_config(role)
        
        raw_cred_id = base64url_to_bytes(data.get('id'))
        rp_id, origin = get_webauthn_env()
        
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            # JOIN the specific passkey table with the user table
            query = f"""
                SELECT u.*, p.public_key, p.sign_count 
                FROM {passkey_table} p
                JOIN {user_table} u ON p.{id_key} = u.id
                WHERE p.credential_id = %s
            """
            cursor.execute(query, (raw_cred_id,))
            result = cursor.fetchone()

            if not result:
                return jsonify({"success": False, "message": f"Passkey not found for {role}"}), 401

            # Verify hardware signature
            verify_auth = verify_authentication_response(
                credential=data,
                expected_challenge=session.pop('auth_challenge'),
                expected_origin=origin,
                expected_rp_id=rp_id,
                credential_public_key=result['public_key'],
                credential_current_sign_count=result['sign_count']
            )

            # Update sign count in the correct table
            cursor.execute(f"UPDATE {passkey_table} SET sign_count = %s WHERE credential_id = %s", (verify_auth.new_sign_count, raw_cred_id))
            conn.commit()

            # POPULATE SESSION (Matching reference login exactly)
            if role == 'admin':
                img = f"/static/uploads/admin/profiles/{result['profile_image'] or 'default-admin-image.png'}"
                session.update({'admin_id': result['id'], 'email': result['email'], 'role': 'admin', 'profile_image': img})
                url = "/admin-dashboard"
            
            elif role == 'staff':
                img = f"/static/uploads/staff/profiles/{result['profile_image'] or 'default-staff-image.png'}"
                session.update({'staff_id': result['id'], 'staff_name': result['full_name'], 'email': result['email'], 'role': 'staff', 'is_temp': result['is_temporary'], 'profile_image': img})
                url = "/staff-dashboard"
            
            else: # Customer
                img = f"/static/uploads/users/profiles/{result['profile_image'] or 'default-user-image.png'}"
                session.update({'user_id': result['id'], 'user_name': result['full_name'], 'email': result['email'], 'role': 'user', 'profile_image': img, 'is_temp': result['is_temp']})
                # Add other customer fields as per  reference code
                session.update({'mobile': result['mobile_number'], 'gender': result['gender'], 'dob': result['dob'].strftime('%Y-%m-%d'), 'city': result['city'], 'address': result['address']})
                url = "/user-dashboard"

            session['has_passkey'] = True
            return jsonify({"success": True, "url": url})
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        if conn: conn.close()

        
@app.route('/remove-passkey', methods=['POST'])
@login_required
def remove_passkey():
    conn = None
    try:
        role = session.get('role')
        _, passkey_table, id_key = get_role_config(role)
        user_id = session.get(id_key)

        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(f"DELETE FROM {passkey_table} WHERE {id_key} = %s", (user_id,))
            conn.commit()
        
        session['has_passkey'] = False 
        return jsonify({"success": True, "message": "Biometrics Disabled."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn: conn.close()


  
@app.route('/account-password-recovery', methods=['POST'])
def account_password_recovery():
    conn = None
    try:
        data = request.get_json()
        email = data.get('email')
        role = data.get('role')

        if not email or not role:
            return jsonify({"success": False, "message": "Email and Role are required"})

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if role == 'staff':
            query = "SELECT id, full_name FROM staff WHERE email = %s"
            cursor.execute(query, (email,))
            user = cursor.fetchone()
        elif role == 'user':
            query = "SELECT id, full_name FROM users WHERE email = %s"
            cursor.execute(query, (email,))
            user = cursor.fetchone()
        else:
            return jsonify({"success": False, "message": "Unauthorized role access"})

        if user:
            temp_pass = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
            update_sql = ""
            ph=PasswordHasher()
            hash_temp_password=ph.hash(temp_pass)
            
            if role=="user":
              update_sql = f"UPDATE users SET password = %s, is_temp=1 WHERE email = %s"
            
            elif role=="staff":
              update_sql = f"UPDATE staff SET password = %s, is_temporary=1 WHERE email = %s"
              
            cursor.execute(update_sql, (hash_temp_password, email))
            conn.commit()

            send_fintrack_email(
                subject="FinTrack | Account Recovery",
                recipient=email,
                template_path="email/passwordRecovery.html",
                name=user['full_name'],
                message=f"Your temporary password is: {temp_pass}."
            )

            return jsonify({
                "success": True, 
                "message": "Recovery Instructions Have Been Sent To Your Email."
            })
        
        return jsonify({
            "success": False, 
            "message": "No Account Found With That Email Address."
        })

    except Exception as e:
        if conn: conn.rollback()
        print(f"Password Recovery Error: {e}")
        return jsonify({"success": False, "message": "Server Error"})
    
    finally:
        if conn: 
            cursor.close()
            conn.close()
   

# Admin Profile


@app.route('/update-admin-credentials', methods=['POST'])
@login_required
def update_admin_credentials():
    try:
        data = request.get_json()
        new_email = data.get('email')
        new_password = data.get('password')
        ph = PasswordHasher()
        hashed_password = ph.hash(new_password)

        if not new_email or not new_password:
            return jsonify({"success": False, "message": "All Fields Are Required"})

        conn = get_db_connection()
        with conn.cursor() as cursor:
         
            sql = "UPDATE admin SET email = %s, password = %s WHERE id = 1"
            cursor.execute(sql, (new_email, hashed_password))
            conn.commit()
            
          
            session['email'] = new_email
            
        return jsonify({
            "success": True, 
            "message": "Security Credentials Updated Successfully"
        })

    except Exception as e:
        if  conn:
            conn.rollback()
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})
        
    finally:
        if  conn:
            conn.close()



@app.route('/upload-admin-profile', methods=['POST'])
@login_required
def upload_admin_profile():
    conn = None
    try:
        if 'admin_image' not in request.files:
            return jsonify({"success": False, "message": "No image found"})
        
        file = request.files['admin_image']
        upload_folder = 'static/uploads/admin/profiles'
        
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)

        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
           
            cursor.execute("SELECT profile_image FROM admin WHERE id = 1")
            result = cursor.fetchone()
            
            if result and result['profile_image']!="default-admin-image.png":
                old_file_path = os.path.join(upload_folder, result['profile_image'])
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)

           
            filename = secure_filename(f"admin_profile_{file.filename}")
            file.save(os.path.join(upload_folder, filename))
            
           
            cursor.execute("UPDATE admin SET profile_image = %s WHERE id = 1", (filename,))
            conn.commit()
            
           
            session['admin_profile_image'] = f"{upload_folder}/{filename}"
            
        return jsonify({
            "success": True, 
            "message": "Profile Image Updated Successfully"
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": f"Upload Error: {str(e)}"})
        
    finally:
        if  conn:
            conn.close()


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))



# General Control

# Dashboard
@app.route("/admin-dashboard")
@login_required
def admin_dashboard():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
         
            cursor.execute("SELECT COUNT(*) as total FROM users")
            total_users = cursor.fetchone()['total']

           
            cursor.execute("SELECT COUNT(*) as total FROM user_details WHERE status = 'pending'")
            pending_kyc = cursor.fetchone()['total']
           
         
            cursor.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM bike_loan_request WHERE status = 'approved' AND customer_status='active') + 
                    (SELECT COUNT(*) FROM gold_loan_request WHERE status = 'approved' AND customer_status='active') 
                as total
            """)
            active_loans = cursor.fetchone()['total']

         
            cursor.execute("SELECT COUNT(*) as total FROM staff ") 
            total_staff = cursor.fetchone()['total']

        return render_template('adminPanel/dashboard.html', 
                       active_loans=f"{active_loans:,}", 
                       total_users=f"{total_users:,}", 
                       pending_kyc=f"{pending_kyc:,}", 
                       total_staff=f"{total_staff:,}")

    except Exception as e:
        print(f"Dashboard Error: {e}")
        return "Internal Server Error", 500
    finally:
        if conn:
            conn.close()



@app.route("/contact-enquiry-view")
@login_required
def contact_enquiry_view():
    return render_template('adminPanel/contactEnquiry.html')

@app.route('/get-inquiries-list', methods=['POST'])
@login_required
def get_inquiries_list():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
          
            sql = """SELECT id, full_name, email as email_address, message_body, inquiry_status,
                     DATE_FORMAT(submitted_at, '%d %b %Y, %h:%i %p') as submitted_at 
                     FROM contact_inquiries ORDER BY id DESC"""
            cursor.execute(sql)
            items = cursor.fetchall()
            
        return jsonify({"success": True, "items": items}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if  conn:
            conn.close()


@app.route('/search-inquiries', methods=['POST'])
@login_required
def search_inquiries():
    conn = None
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            sql = """SELECT id, full_name, email as email_address, message_body, inquiry_status,
                     DATE_FORMAT(submitted_at, '%d %b %Y, %h:%i %p') as submitted_at 
                     FROM contact_inquiries 
                     WHERE full_name LIKE %s OR email LIKE %s OR message_body LIKE %s 
                     ORDER BY id DESC"""
            param = f"%{query}%"
            cursor.execute(sql, (param, param, param))
            items = cursor.fetchall()
            
        return jsonify({"success": True, "items": items}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if  conn:
            conn.close()
            
@app.route('/mark-inquiry-read', methods=['POST'])
@login_required
def mark_read():
    conn = None
    try:
        data = request.get_json()
        inquiry_id = data.get('id')
        
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "UPDATE contact_inquiries SET inquiry_status = 'read' WHERE id = %s"
            cursor.execute(sql, (inquiry_id,))
            conn.commit()
            
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if  conn:
            conn.close()
            

@app.route('/submit-inquiry-reply', methods=['POST'])
@login_required
def submit_reply():
    conn = None
    try:
        data = request.get_json()
        inquiry_id = data.get('id')
        reply_text = data.get('message')
        admin_name = session.get('user_name', 'Admin')
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            sql = """UPDATE contact_inquiries SET 
                     replied_message = %s, 
                     replied_by = %s, 
                     replied_at = NOW(), 
                     inquiry_status = 'replied' 
                     WHERE id = %s"""
            cursor.execute(sql, (reply_text, admin_name, inquiry_id))
            conn.commit()
            sql = "SELECT * FROM contact_inquiries WHERE id = %s"
            cursor.execute(sql, (inquiry_id,))
            inquiry = cursor.fetchone()
            send_fintrack_email(
                subject="FinTrack | Update on your Inquiry",
                recipient=inquiry['email'],
                template_path="email/inquiryReply.html",
                name=inquiry['full_name'],
                message=reply_text
               
            )
        return jsonify({"success": True, "message": "Reply saved and sent email successfully"}), 200
    except Exception as e:
        if  conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if  conn:
            conn.close()
                        

                        
@app.route('/delete-inquiry', methods=['POST'])
@login_required
def delete_inquiry():
    conn = None
    try:
        data = request.get_json()
        inquiry_id = data.get('id')
        
        if not inquiry_id:
            return jsonify({"success": False, "message": "Inquiry ID is required"}), 400

        conn = get_db_connection()
        with conn.cursor() as cursor:
          
            cursor.execute("DELETE FROM contact_inquiries WHERE id = %s", (inquiry_id,))
            conn.commit()
            
        return jsonify({
            "success": True, 
            "message": "Inquiry deleted permanently"
        }), 200
    except Exception as e:
        if  conn: 
            conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if  conn:
            conn.close()


@app.route("/contact-enquiry")
@login_required
def contact_enquiry():
    return render_template('adminPanel/contactEnquiry.html')


@app.route("/site-settings")
@login_required
def site_settings():
    return render_template('adminPanel/siteSettings.html')


@app.route('/get-site-settings', methods=['GET'])
@login_required
def get_settings():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute("SELECT * FROM site_settings WHERE id = 1 LIMIT 1")
            settings = cursor.fetchone()
        return jsonify(settings) if settings else jsonify({}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if  conn:
            conn.close()

@app.route('/update-maintenance-mode', methods=['POST'])
@login_required
def update_maintenance():
    conn = None
    try:
        data = request.get_json()
        status = 1 if data.get('status') else 0
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("UPDATE site_settings SET maintenance_mode = %s WHERE id = 1", (status,))
            conn.commit()
        return jsonify({"success": True, "message": "Maintenance Mode Updated Successfully", "status": status})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if  conn:
            conn.close()

@app.route('/update-site-settings', methods=['POST'])
@login_required
def update_general_settings():
    conn = None
    try:
        data = request.get_json()
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = """
                UPDATE site_settings 
                SET contact_number = %s, email = %s, company_address = %s, 
                    facebook_url = %s, instagram_url = %s, linkedin_url = %s, map_url = %s 
                WHERE id = 1
            """
            values = (data.get('phone'), data.get('email'), data.get('address'),
                      data.get('fb'), data.get('ig'), data.get('li'), data.get('map_url'))
            cursor.execute(sql, values)
            conn.commit()
        return jsonify({"success": True, "message": "Site Settings Saved Successfully"})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if  conn:
            conn.close()




# Admin Panel | Master Settings

# Loan Type(View)
@app.route('/loan-type-view')
@login_required
def loan_type_view():
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute("SELECT * FROM loan_type")
            result = cursor.fetchall()
        
        if not result:
            return render_template(
                'adminPanel/masterSettings/loanTypeView.html', 
                message="No Loan Types Found", 
                success=False,
                loan_types=[]
            )
            
        return render_template(
            'adminPanel/masterSettings/loanTypeView.html', 
            loan_types=result
        )

    except Exception as e:
        return render_template(
            'adminPanel/masterSettings/loanTypeView.html', 
            message=f"Database Error: {str(e)}", 
            success=False,
            loan_types=[]
        )

    finally:
        if  conn:
            conn.close()


# Loan Type(With Interest)
@app.route('/loan-type-with-spread')
@login_required
def loan_type_with_spread():
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute("SELECT * FROM loan_type")
            loan_type = cursor.fetchall()
        
        if not loan_type:
            return render_template(
                'adminPanel/masterSettings/loanTypeWithSpread.html', 
                loan_type=[], 
                message="No Loan Types Found",
                
                success=False
            )
            
        return render_template(
            'adminPanel/masterSettings/loanTypeWithSpread.html', 
            loan_type=loan_type,
           

        )

    except Exception as e:
        return render_template(
            'adminPanel/masterSettings/loanTypeWithSpread.html', 
            message=f"Database Error: {str(e)}", 
            success=False,
            loan_type=[],
           
        )

    finally:
        if  conn:
            conn.close()


@app.route('/loan-spread-set',methods=['POST'])
@login_required
def loan_spread_set():
   try:
        data = request.get_json()
        loan_id = int(data.get('loan_id'))
        interest_spread = float(data.get('interest_spread'))
        
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute("SELECT id FROM spread_settings WHERE loan_id = %s", (loan_id,))
            if cursor.fetchone():
                return jsonify({"success": False, "message": "Spread Rate Already Set For This Loan Type"})
            
            cursor.execute(
                "INSERT INTO spread_settings (loan_id, interest_spread) VALUES (%s, %s)",
                (loan_id, interest_spread)
            )
            conn.commit()
            
        return jsonify({
            "success": True, 
            "message": "Spread Rate Set Successfully", 
            "url": "/loan_type_with_interest"
        })

   except Exception as e:
        if  conn:
            conn.rollback()
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})

   finally:
        if  conn:
            conn.close()


@app.route('/loan-details', methods=['POST'])
@login_required
def loan_details():
    conn = None
    try:
        conn = get_db_connection()
        cursor=conn.cursor(dictionary=True)
        # 1. Fetch the Global Repo Rate first
        current_repo = extract_repo_rate() if extract_repo_rate() is not None else 0.0

        # 2. Fetch Loan Types joined with their specific spreads
        # We use LEFT JOIN so loan types appear even if they don't have a spread set yet
        cursor.execute("""
            SELECT 
                l.id, 
                l.name as loan_type, 
                l.icon, 
                s.interest_spread
            FROM loan_type l 
            LEFT JOIN spread_settings s ON l.id = s.loan_id
        """)
        loan_results = cursor.fetchall()

        if loan_results:
            return jsonify({
                "success": True, 
                "message": "Loan Details Found", 
                "loan_details": loan_results,
                "repo_rate": current_repo  # Sending this so JS can do the math
            })
        
        return jsonify({
            "success": False, 
            "message": "No Loan Details Found"
        })

    except Exception as e:
        print(f"Loan Details Error: {e}")
        return jsonify({
            "success": False, 
            "message": f"Database Error: {str(e)}"
        })

    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/update-loan-spread', methods=['POST'])
@login_required
def update_loan_spread():
    conn = None
    try:
        data = request.get_json()
        
        loan_id = int(data.get('id'))
        
      
        interest_spread = Decimal(str(data.get('spread')))

        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            # Updating the spread_settings table using  interest_spread column
            cursor.execute(
                "UPDATE spread_settings SET interest_spread=%s WHERE loan_id=%s",
                (interest_spread, loan_id)
            )
            conn.commit()
            
            # Check if any row was actually changed
            if cursor.rowcount == 0:
                return jsonify({
                    "success": False, 
                    "message": "No record found to update. Ensure configuration exists."
                })

        return jsonify({
            "success": True, 
            "message": "Interest Spread Updated Successfully"
        })

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({
            "success": False, 
            "message": f"Database Error: {str(e)}"
        })

    finally:
        if conn:
            conn.close()


@app.route("/delete-loan-spread/<int:loan_id>", methods=['DELETE'])
@login_required
def delete_loan_spread(loan_id):
    conn = None
    cursor = None 
    try:
        conn = get_db_connection()
        # Manually create the cursor
        cursor = conn.cursor(dictionary=True)
        
        # Execute the delete operation on  new table
        cursor.execute("DELETE FROM spread_settings WHERE loan_id = %s", (loan_id,))
        conn.commit()

        # Capture rowcount before closing the cursor
        deleted_count = cursor.rowcount
        
        # Manually close the cursor
        cursor.close()

        if deleted_count == 0:
            return jsonify({
                "success": False, 
                "message": "No spread configuration found for this loan type"
            })

        return jsonify({
            "success": True, 
            "message": "Interest Spread Configuration Deleted Successfully"
        })

    except Exception as e:
        if conn:
            conn.rollback()
        # Ensure cursor is closed even on error
        if cursor:
            cursor.close()
        return jsonify({
            "success": False, 
            "message": f"Database Error: {str(e)}"
        })

    finally:
        if conn:
            conn.close()


# Gold Loan Master
@app.route('/gold-type-master')
@login_required
def loan_type_master():
    return render_template('adminPanel/masterSettings/goldTypeMaster.html')

@app.route('/add-gold-item-name',methods=['POST'])
@login_required
def add_gold_item_name():
    data = request.get_json()
    item_name = data.get('itemName')
    
    if not item_name:
        return jsonify({"success": False, "message": "Item name is required"})

    conn = None
    try:
        conn = get_db_connection()
      
        with conn.cursor(dictionary=True) as cursor:
           
            cursor.execute("SELECT id FROM loan_type WHERE name = %s", ("Gold Loan",))
            gold_loan = cursor.fetchone()
            
            if not gold_loan:
                return jsonify({"success": False, "message": "Gold Loan Type Not Found"})
            
            cursor.execute("SELECT id FROM gold_type WHERE item_name = %s", (item_name,))
            existing_item = cursor.fetchone()
            
            if existing_item:
                return jsonify({"success": False, "message": "Item already exists"})
            cursor.execute(
                "INSERT INTO gold_type (loan_id, item_name) VALUES (%s, %s)",
                (gold_loan['id'], item_name) 
            )
            conn.commit() 
            
            return jsonify({"success": True, "message": "Item added successfully"})
            
    except Exception as e:
        if conn:
            conn.rollback() 
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})
    
    finally:
        if conn:
            conn.close() 


@app.route('/get-gold-items', methods=['POST'])
@login_required
def get_gold_items():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            
            cursor.execute("""SELECT gt.id, lt.icon, gt.item_name FROM 
                           gold_type gt JOIN loan_type lt ON 
                           gt.loan_id = lt.id WHERE lt.name = %s""", 
                           ("Gold Loan",))
            items = cursor.fetchall()

        if items:
            return jsonify({"success": True, "gold_items": items})
        
        return jsonify({"success": False, "message": "No items found", "gold_items": []})

    except Exception as e:
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})

    finally:
        if conn:
            conn.close()


@app.route('/update-gold-item', methods=['POST'])
@login_required
def update_gold_item():
    data = request.get_json()
    item_id = data.get('id')
    new_name = data.get('itemName')

    if not item_id or not new_name:
        return jsonify({"success": False, "message": "Invalid data provided"})

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
           
            cursor.execute(
                "UPDATE gold_type SET item_name = %s WHERE id = %s",
                (new_name, item_id)
            )
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({"success": False, "message": "No changes made or item not found"})

        return jsonify({"success": True, "message": "Item updated successfully"})

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})

    finally:
        if conn:
            conn.close()

@app.route('/delete-gold-item/<int:item_id>', methods=['DELETE'])
@login_required
def delete_gold_item(item_id):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
          
            cursor.execute("DELETE FROM gold_type WHERE id = %s", (item_id,))
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({
                    "success": False, 
                    "message": "Item not found or already deleted"
                })

        return jsonify({
            "success": True, 
            "message": "Item deleted successfully"
        })

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({
            "success": False, 
            "message": f"Database Error: {str(e)}"
        })

    finally:
        if conn:
            conn.close()



@app.route('/filter-gold-items', methods=['POST'])
@login_required
def filter_gold_items():
    data = request.get_json()
    search_query = data.get('search', '').strip()
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
          
            sql = """
                SELECT gt.id, gt.item_name, lt.icon 
                FROM gold_type gt
                JOIN loan_type lt ON gt.loan_id = lt.id
                WHERE lt.name = %s
            """
            params = ["Gold Loan"]

            if search_query:
                sql += " AND gt.item_name LIKE %s"
                params.append(f"%{search_query}%")

            cursor.execute(sql, tuple(params))
            items = cursor.fetchall()
            
            return jsonify({
                "success": True, 
                "gold_items": items or [],
                "count": len(items)
            })

    except Exception as e:
        return jsonify({"success": False, "message": f"Filter Error: {str(e)}"})

    finally:
        if conn:
            conn.close()


# Gold Purity Master
@app.route('/gold-purity-master')
@login_required
def gold_purity_master():
    return render_template('adminPanel/masterSettings/goldPurityMaster.html')

@app.route('/add-gold-purity', methods=['POST'])
@login_required
def add_gold_purity():
    data = request.get_json()
    purity_value = data.get('purity')

    if not purity_value:
        return jsonify({"success": False, "message": "Purity value is required"})

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
           
            cursor.execute("SELECT id FROM gold_purity WHERE purity = %s", (purity_value,))
            if cursor.fetchone():
                return jsonify({"success": False, "message": "This purity value already exists"})
            
            cursor.execute("SELECT id FROM loan_type WHERE name = %s", ("Gold Loan",))
            loan_id = cursor.fetchone()['id']

      
            cursor.execute(
                "INSERT INTO gold_purity (loan_id, purity) VALUES (%s,%s)",
                (loan_id,purity_value,)
            )
            conn.commit()

        return jsonify({"success": True, "message": "Purity added successfully"})

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})

    finally:
        if conn:
            conn.close()


@app.route('/get-gold-purities', methods=['POST'])
@login_required
def get_gold_purities():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
           
            query = """
                SELECT gp.id, gp.purity 
                FROM gold_purity gp
                JOIN loan_type lt ON gp.loan_id = lt.id
                WHERE lt.name = %s
                ORDER BY gp.purity DESC
            """
            cursor.execute(query, ("Gold Loan",))
            purities = cursor.fetchall()

        return jsonify({
            "success": True, 
            "purities": purities or []
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})

    finally:
        if conn:
            conn.close()


@app.route('/update-gold-purity', methods=['POST'])
@login_required
def update_gold_purity():
    data = request.get_json()
    item_id = data.get('id')
    new_purity = data.get('purity')

    if not item_id or not new_purity:
        return jsonify({"success": False, "message": "Missing ID or Purity value"})

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
           
            cursor.execute(
                "UPDATE gold_purity SET purity = %s WHERE id = %s",
                (new_purity, item_id)
            )
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({"success": False, "message": "No changes made or record not found"})

        return jsonify({"success": True, "message": "Purity updated successfully"})

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})

    finally:
        if conn:
            conn.close()


@app.route('/delete-gold-purity/<int:purity_id>', methods=['DELETE'])
@login_required
def delete_gold_purity(purity_id):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute("DELETE FROM gold_purity WHERE id = %s", (purity_id,))
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({"success": False, "message": "Record not found"})

        return jsonify({"success": True, "message": "Purity deleted successfully"})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()


@app.route('/filter-gold-purities', methods=['POST'])
@login_required
def filter_gold_purities():
    data = request.get_json() or {}
    search_term = data.get('search', '').strip()
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            
            sql = """
                SELECT gp.id, gp.purity 
                FROM gold_purity gp
                JOIN loan_type lt ON gp.loan_id = lt.id
                WHERE lt.name = %s
            """
            params = ["Gold Loan"]

          
            if search_term:
                sql += " AND gp.purity LIKE %s"
                params.append(f"%{search_term}%")

            sql += " ORDER BY gp.purity DESC"
            
            cursor.execute(sql, tuple(params))
            results = cursor.fetchall()

            return jsonify({
                "success": True, 
                "purities": results or []
            })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn:
            conn.close()


# Bike Master
@app.route('/bike-master')
@login_required
def bike_master():
    return render_template('adminPanel/masterSettings/bikeMaster.html')


@app.route('/add-bike-info-master', methods=['POST'])
@login_required
def add_bike_master():
    data = request.get_json()
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
          
            cursor.execute("SELECT id FROM loan_type WHERE name = %s", ("Bike Loan",))
            loan_row = cursor.fetchone()
            loan_id = loan_row['id'] if loan_row else None

            if not loan_id:
                return jsonify({"success": False, "message": "Bike Loan category not found in master"})

           
            sql = """
                INSERT INTO bike_master 
                (loan_id, bike_type, bike_name, company_name, bike_model, enginecc, showroom_price, on_road_price, fuel_type, gst_rate) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                loan_id,
                data['bike_type'],
                data['bike_name'],
                data['company_name'],
                data['bike_model'],
                data['engine_cc'],
                data['showroom_price'],
                data['onroad_price'],
                data['fuel_type'],
                data['gst_rate']
            )
            
            cursor.execute(sql, values)
            conn.commit()

        return jsonify({"success": True, "message": "Bike Master record added successfully!"})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()


@app.route('/get-bike-info', methods=['POST'])
@login_required
def get_bike_info():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
           
            query = """
                SELECT b.* FROM bike_master b
                JOIN loan_type l ON b.loan_id = l.id
                WHERE l.name = 'Bike Loan'
                ORDER BY b.id DESC
            """
            cursor.execute(query)
            items = cursor.fetchall()
            
            items = [{**row, 'date': row.pop('created_at')} for row in items if 'created_at' in row]
            items=inject_application_numbers(items,"vehicle")
            return jsonify({
                "success": True,
                "bike_items": items or []
            })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()



@app.route('/update-bike-master', methods=['POST'])
@login_required
def update_bike_master():
    data = request.get_json()
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = """
                UPDATE bike_master 
                SET bike_type = %s, bike_name = %s, company_name = %s, 
                    bike_model = %s, enginecc = %s, fuel_type = %s, 
                    showroom_price = %s, on_road_price = %s, gst_rate = %s
                WHERE id = %s
            """
            
          
            params = (
                data['bike_type'],       
                data['bike_name'], 
                data['company_name'],
                data['bike_model'],
                data['engine_cc'],        
                data['fuel_type'], 
                data['showroom_price'],
                data['onroad_price'], 
                data['gst_rate'], 
                data['id']
            )
            
            cursor.execute(sql, params)
            conn.commit()

          
            if cursor.rowcount > 0:
                return jsonify({"success": True, "message": "Bike Details Updated Successfully!"})
            else:
                return jsonify({"success": False, "message": "No Changes Were Made Or Record Not Found."})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})
    finally:
        if conn: conn.close()


@app.route('/delete-bike-item/<int:id>', methods=['DELETE'])
@login_required
def delete_bike_item(id):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
        
            sql = "DELETE FROM bike_master WHERE id = %s"
            cursor.execute(sql, (id,))
            
         
            conn.commit()

           
            if cursor.rowcount > 0:
                return jsonify({
                    "success": True, 
                    "message": "Bike specification deleted successfully!"
                })
            else:
                return jsonify({
                    "success": False, 
                    "message": "Record not found."
                })

    except Exception as e:
        # Rollback in case of error
        if conn:
            conn.rollback()
        return jsonify({
            "success": False, 
            "message": f"Database Error: {str(e)}"
        })
    finally:
        if conn:
            conn.close()


@app.route('/filter-bike-info', methods=['POST'])
@login_required
def filter_bike_info():
    data = request.get_json() or {}
    search_query = data.get('query', '').strip()
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            if search_query:
                if 'VL-' in search_query:
                    if bool(re.match(r"^VL-\d{6}-\d{6}-\d+$", search_query)):
                        sql = """
                              SELECT * FROM bike_master WHERE created_at=%s AND id=%s  ORDER BY id DESC
                            """
                        # print()
                        print(get_transaction_time(search_query),f"{search_query.split('-')[-1]}")
                        params=(get_transaction_time(search_query),f"{search_query.split('-')[-1]}")
                        cursor.execute(sql,params)
                else:
                    sql = """
                        SELECT * FROM bike_master 
                        WHERE bike_name LIKE %s 
                        OR company_name LIKE %s 
                        OR CAST(bike_model AS CHAR) LIKE %s
                        OR CAST(gst_rate AS CHAR) LIKE %s
                        ORDER BY id DESC
                    """
                    formatted_param = f"%{search_query}%"
                   
                    params = (formatted_param,) * 4
                    cursor.execute(sql, params)
            else:
                sql = "SELECT * FROM bike_master ORDER BY id DESC"
                cursor.execute(sql)
                
            rows = cursor.fetchall()
            rows =[{**row, 'date': row.pop('created_at')} for row in rows if 'created_at' in row]
            rows=inject_application_numbers(rows,"vehicle")
            return jsonify({"success": True, "bike_items": rows})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()



# Staff Registration

@app.route('/staff-registration-form')
@login_required
def staff_registration():
    return render_template('adminPanel/masterSettings/staffRegistration.html')


@app.route('/register-staff', methods=['POST'])
@login_required
def register_staff():
    data = request.get_json()
    ph=PasswordHasher()
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = """
                INSERT INTO staff (
                    full_name, address, city, mob_number, 
                    gender, email, password, dob, joining_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            params = (
                data['full_name'], 
                data['address'], 
                data['city'], 
                data['mob_number'], 
                data['gender'], 
                data['email'], 
                ph.hash(data['password']),
                data['dob'], 
                data['joining_date']
            )
            cursor.execute(sql, params)
            conn.commit()
          
            try:
            
                msg = Message(
                    subject="Welcome to FinTrack - Your Staff Account is Ready",
                    sender=app.config['MAIL_USERNAME'],
                    recipients=[data['email']]
                )
                
               
                msg.html = render_template(
                    'email/sendStaffRegistrationEmail.html',
                    full_name=data['full_name'],
                    email=data['email'],
                    password=data['password'],
                    home_url=url_for('index',_external=True)
                )
                
                mail.send(msg)
                email_status = "And Notification Email Sent."
            except Exception as mail_err:
                print(f"Mail Error: {mail_err}")
                email_status = "But Failed To Send Notification Email."
        

            return jsonify({
                "success": True, 
                "message": f"Staff Member Registered Successfully {email_status}"
            })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": f"Registration Failed: {str(e)}"})
    finally:
        if conn: conn.close()


# Staff View
@app.route('/staff-view')
@login_required
def staff_view():
    return render_template('adminPanel/masterSettings/staffView.html')


@app.route('/get-staff-list', methods=['POST'])
@login_required
def get_staff_list():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            
            sql = "SELECT * FROM staff ORDER BY id DESC"
            cursor.execute(sql)
            rows = cursor.fetchall()
            
            # Format dates to string for JSON serialization
            for row in rows:
                if row['dob']: row['dob'] = row['dob'].strftime('%Y-%m-%d')
                if row['joining_date']: row['joining_date'] = row['joining_date'].strftime('%Y-%m-%d')
            
            rows =[{**row, 'date': row.pop('created_at')} for row in rows if 'created_at' in row]
            rows=inject_application_numbers(rows,"staff")
            return jsonify({
                "success": True, 
                "staff_items": rows
            })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()



@app.route('/update-staff-details', methods=['POST'])
@login_required
def update_staff():
    data = request.get_json()
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
           
            sql = """
                UPDATE staff SET 
                full_name=%s, city=%s, mob_number=%s, email=%s, 
                address=%s, dob=%s, joining_date=%s 
                WHERE id=%s
            """
            params = (
                data['full_name'], data['city'], data['mob_number'],
                data['email'], data['address'], data['dob'],
                data['joining_date'], data['id']
            )
            cursor.execute(sql, params)
            conn.commit()
            return jsonify({"success": True,"message":"Staff Updated Successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()



@app.route('/search-staff', methods=['POST'])
@login_required
def search_staff():
    data = request.get_json() or {}
    search_query = data.get('query', '').strip()
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            params=[]
            if search_query:
               
                 if 'SN-' in search_query:
                    if bool(re.match(r"^SN-\d{6}-\d{6}-\d+$", search_query)):
                        sql = """
                                SELECT * FROM staff 
                                WHERE  created_at=%s AND id=%s
                                ORDER BY id DESC
                            """
                        
                        params=(get_transaction_time(search_query),f"{search_query.split('-')[-1]}")
                        cursor.execute(sql,params)
                    
                 else:
                    sql = """
                        SELECT * FROM staff 
                        WHERE full_name LIKE %s 
                        OR city LIKE %s 
                        OR mob_number LIKE %s
                        OR email LIKE %s
                        ORDER BY id DESC
                    """
                    
                    params = (f"%{search_query}%",f"%{search_query}%",f"%{search_query}%",f"%{search_query}%")  
                    cursor.execute(sql, params)
            else:
                 
                sql = "SELECT * FROM staff ORDER BY id DESC"
                cursor.execute(sql)
            
            
            rows = cursor.fetchall()
            rows =[{**row, 'date': row.pop('created_at')} for row in rows if 'created_at' in row]
            rows=inject_application_numbers(rows,"staff")
            
            # Date formatting for JSON compatibility
            for row in rows:
                if row['dob']: row['dob'] = row['dob'].strftime('%Y-%m-%d')
                if row['joining_date']: row['joining_date'] = row['joining_date'].strftime('%Y-%m-%d')
            
            return jsonify({"success": True, "staff_items": rows})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()

@app.route('/delete-staff-details', methods=['POST'])
@login_required
def delete_staff():
    data = request.get_json()
    staff_id = data.get('id')
    
    if not staff_id:
        return jsonify({"success": False, "message": "No Staff ID provided"})

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            
            sql = "DELETE FROM staff WHERE id = %s"
            cursor.execute(sql, (staff_id,))
            
            conn.commit()
            
            # Check if a row was actually deleted
            if cursor.rowcount > 0:
                return jsonify({"success": True, "message": "Staff Member Removed Successfully"})
            else:
                return jsonify({"success": False, "message": "Staff Member Record Not Found"})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn: conn.close()



# Admin Panel | Customer Desk

# Document Verification
@app.route('/document-verification')
@login_required
def document_verification():
    return render_template('adminPanel/customerDesk/documentVerification.html')




@app.route('/update-verification-status', methods=['POST'])
@login_required
def update_verification_status():
    data = request.json
    user_id = data.get('user_id')
    new_status = data.get('status') 
    
   
    reasons = {
        "approved": (
            "Congratulations! Your identity has been successfully verified. "
            "Your account is now fully active, and you can proceed with your financial requests."
        ),
        "rejected": (
            "The submitted documents do not meet our verification requirements "
            "(e.g., blurriness, expiry, or mismatched details). Please re-upload "
            "your latest original documents via the 'Account Mgmt -> Documents Status' "
            "portal or visit our staff for physical re-verification."
        )
    }
    
   
    selected_reason = reasons.get(new_status, "Your application status has been updated.")
     
    email_status = ""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        info_query = """
            SELECT u.full_name, u.email, ud.created_at 
            FROM users u 
            JOIN user_details ud ON u.id = ud.user_id 
            WHERE u.id = %s
        """
        cursor.execute(info_query, (user_id,))
        user_info = cursor.fetchone()

        if not user_info:
            return jsonify({"success": False, "message": "User not found"})

        update_query = "UPDATE user_details SET status = %s WHERE user_id = %s"
        cursor.execute(update_query, (new_status, user_id))
        conn.commit()
        
        
        user_info['date'] = user_info.pop('created_at')
        app_no = inject_application_numbers([user_info], "verification")[0]['app_no']

        print(app_no)
        try:
            msg = Message(
                subject=f"Document Verification {new_status} - FinTrack",
                sender=app.config['MAIL_USERNAME'],
                recipients=[user_info['email']]
            )
            
            msg.html = render_template(
                'email/documentVerificationStatusEmail.html',
                user_name=user_info['full_name'],
                status=new_status,
                app_no=app_no,
                reason=selected_reason,
                dashboard_url=url_for('index', _external=True)
            )
            
            mail.send(msg)
            email_status = "And Notification Email Sent."
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}")
            email_status = "But Failed To Send Notification Email."

        return jsonify({
            "success": True, 
            "message": f"Application {new_status.capitalize()} Successfully {email_status}"
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn:
            cursor.close()
            conn.close()




# Loan Approved

@app.route('/loan-approved')
@login_required
def loan_approved():
    return render_template('adminPanel/customerDesk/loanApproved.html')


@app.route('/loan-approved-details/<loan_type>')
@login_required
def loan_approved_details(loan_type):
    if loan_type=='bike':
      return render_template('adminPanel/customerDesk/approvedBikeLoans.html')
    elif loan_type=='gold':
      return render_template('adminPanel/customerDesk/approvedGoldLoans.html')


@app.route('/get-gold-records', methods=['POST'])
@login_required
def get_gold_records():
    conn = None
    try:
        data = request.get_json() or {}
        search_query = data.get('search', '').strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        sql = """
            SELECT 
                gl.id, 
                gl.customer_id, 
                u.full_name AS name, 
                u.mobile_number AS phone, 
                u.email, 
                lt.name AS gold_type, 
                gl.gold_weight, 
                gl.processing_fee, 
                gl.loan_amount, 
                gl.expected_month, 
                gl.status, 
                gl.description, 
                gl.date, 
                gl.monthly_emi , 
                gl.appointment_date AS appt_date, 
                gl.appointment_time AS appt_time, 
                gl.customer_status, 
                gl.estimated_amount AS est_amount,
                gl.interest_rate
                
            FROM gold_loan_request gl
            LEFT JOIN users u ON gl.customer_id = u.id
            LEFT JOIN loan_type lt ON gl.gold_loan_id = lt.id
            WHERE gl.status =%s
        """

        if search_query:
            if 'GL-' in search_query:
                 if bool(re.match(r"^GL-\d{6}-\d{6}-\d+$", search_query)):
                    sql_ =sql+ " AND gl.date=%s AND gl.id=%s"
                    print(get_transaction_time(search_query))
                    params=('approved',get_transaction_time(search_query),f"{search_query.split('-')[-1]}")
                    cursor.execute(sql_,params)
                 else:
                     return jsonify([]) 
            else:     
                where_clause = """ 
                    WHERE u.full_name LIKE %s 
                    OR u.email LIKE %s 
                    OR u.mobile_number LIKE %s 
                    OR gl.id LIKE %s 
                """
                params = ('approved',f"%{search_query}%", f"%{search_query}%", f"%{search_query}%", f"%{search_query}%")
                cursor.execute(sql + where_clause + " ORDER BY gl.date DESC", params)
        else:
            cursor.execute(sql + " ORDER BY gl.date DESC", ('approved',))

        rows = cursor.fetchall()
      
        for row in rows:
            for key, value in row.items():
                if isinstance(value, (timedelta, date)):
                    row[key] = str(value)
                elif value is None:
                    row[key] = ""
                
                if key in ['loan_amount', 'loan_emi', 'est_amount'] and value is not None:
                    row[key] = float(value)
        rows=inject_application_numbers(rows,"gold loan")   
        return jsonify(rows)
        
    except Exception as e:
        return jsonify([])
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/get-bike-loan-records', methods=['POST'])
@login_required
def get_bike_loan_records():
    conn = None
    try:
        data = request.get_json() or {}
        search_query = data.get('q', '').strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id FROM loan_type WHERE name = 'Bike Loan' LIMIT 1")
        category = cursor.fetchone()
        
        if not category:
            return jsonify([])
        
        bike_loan_type_id = category['id']

        sql = """
            SELECT 
                bl.*, 
                u.full_name AS name, 
                u.mobile_number AS phone, 
                u.email,
                bm.bike_name, 
                bm.company_name, 
                bm.bike_type,
                bm.enginecc, 
                bm.fuel_type, 
                bm.on_road_price AS onroad_price,
                bl.credit_score,
                bl.date
            FROM bike_loan_request bl
            LEFT JOIN users u ON bl.customer_id = u.id
            LEFT JOIN bike_master bm ON bl.bike_id = bm.id
            WHERE bm.loan_id = %s AND bl.status = %s
        """

        if search_query:
            if 'BL-' in search_query:
                 if bool(re.match(r"^BL-\d{6}-\d{6}-\d+$", search_query)):
                    sql_ =sql+ " AND bl.date=%s AND bl.id=%s"
                    print(get_transaction_time(search_query))
                    params=(bike_loan_type_id,'approved' , get_transaction_time(search_query),f"{search_query.split('-')[-1]}")
                    cursor.execute(sql_,params)
                 else:
                     return jsonify([])    
            else:     
                sql += " AND (u.full_name LIKE %s OR u.mobile_number LIKE %s OR bl.customer_id LIKE %s)"
                params = ('approved',bike_loan_type_id, f"%{search_query}%", f"%{search_query}%", f"%{search_query}%")
                cursor.execute(sql + " ORDER BY bl.date DESC", params)                 
        
        else:
            cursor.execute(sql + " ORDER BY bl.date DESC", (bike_loan_type_id,'approved'))

        rows = cursor.fetchall()
        
        for row in rows:
            for key, value in row.items():
                if isinstance(value, (timedelta, date)):
                    row[key] = str(value)
                elif value is None:
                    row[key] = ""
                
                if key in ['final_amount', 'monthly_emi', 'onroad_price', 'showroom_price']:
                    try:
                        row[key] = float(value) if value != "" else 0.0
                    except (ValueError, TypeError):
                        row[key] = 0.0
        rows =inject_application_numbers(rows, 'bike loan')
               
        return jsonify(rows)

    except Exception as e:
        return jsonify([])
    finally:
        if conn:
            cursor.close()
            conn.close()
            
            
        

@app.route('/loan-approved-details/<loan_type>/emil-status/<loan_request_id>')
@login_required
def loan_type_for_emi_status(loan_type, loan_request_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if loan_type == 'bike':
            query = """
                SELECT bl.id,
                    bl.final_amount, bl.monthly_emi, bl.expected_month, 
                    bl.appointment_date, bm.company_name, bm.bike_model, bm.bike_name, bl.date,bl.interest_rate
                FROM bike_loan_request bl
                JOIN bike_master bm ON bl.bike_id = bm.id
                WHERE bl.id = %s
            """
            cursor.execute(query, (loan_request_id,))
            bike_loan = cursor.fetchone()
           
            bike_loan=inject_application_numbers(bike_loan,'bike loan')[0]
            print(bike_loan)
           
            if not bike_loan: return "Bike Loan record not found", 404
            
            return render_template('adminPanel/customerDesk/approvedBikeLoansEMIStatus.html', bike_loan=bike_loan)

        elif loan_type == 'gold':
            
            query = """
                SELECT 
                    gl.id,
                    gt.item_name,
                    gl.gold_weight,
                    gl.loan_amount,
                    gl.expected_month,
                    gl.monthly_emi,
                    gl.appointment_date,
                    gl.date,
                    gl.interest_rate
                FROM gold_loan_request gl
                JOIN gold_type gt ON gl.gold_loan_type_id = gt.id
                WHERE gl.id = %s
            """
            cursor.execute(query, (loan_request_id,))
            gold_loan = cursor.fetchone()
            gold_loan=inject_application_numbers(gold_loan,'gold loan')[0]
            if not gold_loan:
                return "Gold Loan record not found", 404
                
            return render_template('adminPanel/customerDesk/approvedGoldLoansEMIStatus.html', gold_loan=gold_loan)

    except Exception as e:
        print(f"Error: {e}")
        return "Internal Server Error", 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/get-bike-loan-emi/<int:request_id>', methods=['POST'])
@login_required
def get_bike_loan_emi(request_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                be.installment_no,
                be.due_date AS date,
                be.emi_amount AS amount,
                be.status,
                be.late_fee AS late_fee,
                be.emi_time As emi_time,
                bl.expected_month,
                be.emi_date AS pay_date
            FROM bike_loan_emi be
            JOIN bike_loan_request bl ON be.bike_loan_request_id = bl.id
            WHERE be.bike_loan_request_id = %s
            ORDER BY be.installment_no ASC
        """
        cursor.execute(query, (request_id,))
        rows = cursor.fetchall()
       
        for row in rows:
            row['date'] = row['date'].strftime('%Y-%m-%d') if row['date'] else ""
            row['pay_date'] = row['pay_date'].strftime('%Y-%m-%d') if row['pay_date'] else ""
            row['emi_time'] = str(row['emi_time']) if row['emi_time'] else "00:00:00"
            row['amount'] = float(row['amount'])
            row['late_fee'] = float(row['late_fee'])
        
        cursor.execute("SELECT expected_month FROM bike_loan_request WHERE id = %s", (request_id,))
        emi_month = cursor.fetchone()
        return jsonify({
                    "installments":rows,
                     "emi_month":emi_month["expected_month"]
                    })
    except Exception as e:
        return jsonify([])
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/get-gold-loan-emi/<int:request_id>', methods=['POST'])
@login_required
def get_gold_loan_emi(request_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                ge.installment_no,
                ge.due_date AS date,
                ge.emi_amount AS amount,
                ge.status,
                ge.late_fee AS late_fee,
                ge.emi_time AS emi_time,
                ge.emi_date AS pay_date
               
            FROM gold_loan_emi ge
            JOIN gold_loan_request gl ON ge.gold_loan_request_id = gl.id
            WHERE ge.gold_loan_request_id = %s
            ORDER BY ge.installment_no ASC
        """
        cursor.execute(query, (request_id,))
        rows = cursor.fetchall()
       
        for row in rows:
            row['date'] = row['date'].strftime('%Y-%m-%d') if row['date'] else ""
            row['pay_date'] = row['pay_date'].strftime('%Y-%m-%d') if row['pay_date'] else ""
            row['emi_time'] = str(row['emi_time']) if row['emi_time'] else "00:00:00"
            row['amount'] = float(row['amount'])
            row['late_fee'] = float(row['late_fee'])
        
        cursor.execute("SELECT expected_month FROM gold_loan_request WHERE id = %s", (request_id,))
        emi_month = cursor.fetchone()

        return jsonify({
            "installments": rows,
            "emi_month":emi_month["expected_month"]
        })
    except Exception as e:
        return jsonify([])
    finally:
        if conn:
            cursor.close()
            conn.close()



# Staff Panel
# Profile

@app.route('/upload-staff-profile', methods=['POST'])
@login_required
def upload_staff_profile():
    conn = None
    try:
        if 'staff_image' not in request.files:
            return jsonify({"success": False, "message": "No image found"})
        
        file = request.files['staff_image']
        staff_id = session.get('staff_id')
        upload_folder = 'static/uploads/staff/profiles'
        
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)

        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            
            cursor.execute("SELECT profile_image FROM staff WHERE id = %s", (staff_id,))
            result = cursor.fetchone()
            
            if result and result['profile_image']:
                current_image = result['profile_image']
                
                # CONDITION: Only delete if it's NOT the default image
                if "default" not in current_image.lower():
                    old_file_path = os.path.join(upload_folder, current_image)
                    if os.path.exists(old_file_path):
                        os.remove(old_file_path)

          
            filename = secure_filename(f"staff_{staff_id}_{file.filename}")
            file.save(os.path.join(upload_folder, filename))
            
           
            cursor.execute("UPDATE staff SET profile_image = %s WHERE id = %s", (filename, staff_id))
            conn.commit()
            
           
            new_path = f"{upload_folder}/{filename}"
            session['profile_image'] = f"/{new_path}"
            
        return jsonify({
            "success": True, 
            "message": "Profile Image Updated Successfully",
            "new_url": f"/{new_path}"
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": f"Upload Error: {str(e)}"})
    finally:
        if conn: conn.close()



@app.route('/update-staff-credentials', methods=['POST'])
@login_required
def update_staff_credentials():
    conn = None
    try:
       
        new_password = request.form.get('password')
        ph=PasswordHasher()
        hashed_password = ph.hash(new_password)
        staff_id = session.get('staff_id')

        if not staff_id:
            return jsonify({"success": False, "message": "Session expired. Please login again."})

        conn = get_db_connection()
        with conn.cursor() as cursor:
            
            if new_password and session['is_temp']:
                cursor.execute("UPDATE staff SET password = %s, is_temporary =%s WHERE id = %s", (hashed_password,0,staff_id))
            
            if new_password:
                
                cursor.execute("UPDATE staff SET password = %s WHERE id = %s", (hashed_password, staff_id))
                
            conn.commit()
        session['is_temp'] = False
        return jsonify({
            "success": True, 
            "message": "Credentials Updated Successfully"
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": f"Update Error: {str(e)}"})
    finally:
        if conn: conn.close()



# Dashboard
@app.route('/staff-dashboard')
@login_required
def staff_dashboard():
   
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            
          
            cursor.execute("SELECT gram_price,is_realtime FROM gold_price ORDER BY id DESC LIMIT 1")
            gold_row = cursor.fetchone()
            gold_price = 0.0
            
            if gold_row['is_realtime'] == 1:
               
                try:
                    gold_price=extract_gold_price()
                        
                except Exception as e:
                    gold_price = gold_row['gram_price']
                    cursor.execute(
                            "UPDATE gold_price SET is_realtime = %s", 
                            (0,)
                        ) 
                    conn.commit()  
                    print(f"Price Fetch Error : {e}")
            
            else:
                 gold_price = gold_row['gram_price']
           
            
            cursor.execute("SELECT COUNT(*) as total FROM users")
            total_users = cursor.fetchone()['total']

            
            cursor.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM bike_loan_request WHERE status = 'pending') + 
                    (SELECT COUNT(*) FROM gold_loan_request WHERE status = 'pending') 
                as total
            """)
            pending_loans= cursor.fetchone()['total']

            
            cursor.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM bike_loan_request WHERE status = 'approved' AND customer_status='active') + 
                    (SELECT COUNT(*) FROM gold_loan_request WHERE status = 'approved' AND customer_status='active') 
                as total
            """)
            active_loans = cursor.fetchone()['total']

        return render_template('staffPanel/dashboard.html', 
                               gold_price=gold_price,
                               total_users=total_users,
                               pending_loans=pending_loans,
                               active_loans=active_loans)
                               
    except Exception as e:
        print(f"Dashboard Data Error: {e}")
        return "Internal Server Error"
    finally:
        if conn:
            conn.close()



@app.route('/api/staff/stats')
# @login_required 
def get_staff_graph_data():
    # 1: Handle empty string or missing 'year' from request
    year_raw = request.args.get('year', '').strip()
    year = int(year_raw) if year_raw and year_raw.isdigit() else datetime.now().year
    
    # 2: Handle empty string for 'month'
    month = request.args.get('month', 'all')
    if not month or month == '':
        month = 'all'
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        labels = []
        loan_series = []
        user_series = []
        processed_series = []

        if month == 'all':
            labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            for m in range(1, 13):
                #  3: Standardize column names to match  Data Dictionary (created_at vs created at)
                cursor.execute("""
                    SELECT 
                        (SELECT COALESCE(SUM(final_amount), 0) FROM bike_loan_request WHERE YEAR(date) = %s AND MONTH(date) = %s AND status='approved' AND customer_status='active') +
                        (SELECT COALESCE(SUM(loan_amount), 0) FROM gold_loan_request WHERE YEAR(date) = %s AND MONTH(date) = %s AND status='approved' AND customer_status='active') 
                    as vol""", (year, m, year, m))
                res = cursor.fetchone()
                loan_series.append(float(res['vol'] or 0))

                cursor.execute("SELECT COUNT(*) as count FROM user_details WHERE YEAR(created_at) = %s AND MONTH(created_at) = %s", (year, m))
                user_series.append(cursor.fetchone()['count'])

                cursor.execute("""
                    SELECT 
                        (SELECT COUNT(*) FROM bike_loan_request WHERE status NOT IN ('pending', 'rejected') AND YEAR(date) = %s AND MONTH(date) = %s) +
                        (SELECT COUNT(*) FROM gold_loan_request WHERE status NOT IN ('pending', 'rejected') AND YEAR(date) = %s AND MONTH(date) = %s)
                    as total""", (year, m, year, m))
                processed_series.append(cursor.fetchone()['total'])
        else:
            m_idx = int(month)
            days = calendar.monthrange(year, m_idx)[1]
            labels = [str(i) for i in range(1, days + 1)]
            for d in range(1, days + 1):
                cursor.execute("""
                    SELECT 
                        (SELECT COALESCE(SUM(final_amount), 0) FROM bike_loan_request WHERE YEAR(date) = %s AND MONTH(date) = %s AND DAY(date) = %s AND status='approved') +
                        (SELECT COALESCE(SUM(loan_amount), 0) FROM gold_loan_request WHERE YEAR(date) = %s AND MONTH(date) = %s AND DAY(date) = %s AND status='approved') 
                    as vol""", (year, m_idx, d, year, m_idx, d))
                res = cursor.fetchone()
                loan_series.append(float(res['vol'] or 0))

                cursor.execute("SELECT COUNT(*) as count FROM user_details WHERE YEAR(created_at) = %s AND MONTH(created_at) = %s AND DAY(created_at) = %s", (year, m_idx, d))
                user_series.append(cursor.fetchone()['count'])

                cursor.execute("""
                    SELECT 
                        (SELECT COUNT(*) FROM bike_loan_request WHERE status NOT IN ('pending', 'rejected') AND YEAR(date) = %s AND MONTH(date) = %s AND DAY(date) = %s) +
                        (SELECT COUNT(*) FROM gold_loan_request WHERE status NOT IN ('pending', 'rejected') AND YEAR(date) = %s AND MONTH(date) = %s AND DAY(date) = %s)
                    as total""", (year, m_idx, d, year, m_idx, d))
                processed_series.append(cursor.fetchone()['total'])

        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as app,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pen,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rej
            FROM (
                SELECT status FROM bike_loan_request
                UNION ALL
                SELECT status FROM gold_loan_request
            ) as combined_status
        """)
        s_res = cursor.fetchone() or {'app': 0, 'pen': 0, 'rej': 0}

        return jsonify({
            "labels": labels,
            "loans": loan_series,
            "users": user_series,
            "staff": processed_series,
            "kyc": [int(s_res['app'] or 0), int(s_res['pen'] or 0), int(s_res['rej'] or 0)]
        })

    except Exception as e:
        # Log the error for debugging
        print(f"API Error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()



# Customer Desk
# Customer Registration

@app.route("/customer-registration-form")
@login_required
def customer_registration_from():
    return render_template('staffPanel/customerDesk/customerRegistration.html')


@app.route('/submit-customer-registration', methods=['POST'])
@login_required
def submit_registration():
    conn = None
    try:
        full_name = request.form.get('full_name')
        email = request.form.get('email')
        mobile = request.form.get('number')
        password = request.form.get('password')
        gender = request.form.get('gender')
        dob = request.form.get('dob')
        address = request.form.get('address')
        city = request.form.get('city')

        ph=PasswordHasher()
        hashed_password=ph.hash(password)
        
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            user_sql = """
                INSERT INTO users (full_name, email, password,mobile_number, gender, dob,address, city) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(user_sql, (full_name, email,  hashed_password, mobile, gender, dob, address, city, ))
            user_id = cursor.lastrowid

            base_path = 'static/uploads/users/documents/'
            doc_mapping = {
                'aadhar_card_photo': 'aadhar_card',
                'pan_card_photo': 'pan_card',
                'passport_photo': 'passport',
                'light_bill_photo': 'light_bill'
            }

            stored_names = {}
            timestamp = int(time.time()) 

            for form_key, folder_name in doc_mapping.items():
                file = request.files.get(form_key)
                
                if file and file.filename != '':
                    _, ext = os.path.splitext(file.filename)
                    ext = ext.lower()
                    
                    target_dir = os.path.join(base_path, folder_name)
                    if not os.path.exists(target_dir):
                        os.makedirs(target_dir)

                    new_filename = f"user_{user_id}_{folder_name}_{timestamp}{ext}"
                    
                    save_path = os.path.join(target_dir, new_filename)
                    file.save(save_path)
                    
                    # Store ONLY the filename in the dictionary
                    stored_names[form_key] = new_filename
                else:
                    stored_names[form_key] = None

            details_sql = """
                INSERT INTO user_details (
                    user_id, aadhar_card_photo, 
                    pan_card_photo, passport_photo, light_bill_photo, status
                ) VALUES (%s, %s, %s, %s, %s, 'pending')
            """
            cursor.execute(details_sql, (
                user_id,
                stored_names['aadhar_card_photo'], 
                stored_names['pan_card_photo'], 
                stored_names['passport_photo'], 
                stored_names['light_bill_photo']
            ))

            conn.commit()
            
            cursor.execute("""
                          INSERT INTO digital_wallet (customer_id) 
                          VALUES (%s)
                          """, (user_id,))
            conn.commit()
            
            try:
                msg = Message(
                    subject="Your FinTrack Account Details",
                    recipients=[email]
                )
                msg.html = render_template(
                    'email/sendUserRegistrationEmail.html',
                    full_name=full_name,
                    email=email,
                    password=password,
                    home_url=url_for('index',_external=True)
                )
                mail.send(msg)
            except Exception as e:
                print(f"Mail failed: {e}")

        return jsonify({"success": True, "message": "Registration successful"})

    except Exception as e:
        if conn: conn.rollback()
        print(f"Error: {e}")
        return jsonify({"success": False, "message": "Server error"})
    finally:
        if conn: conn.close()


# Customer View
@app.route('/register-customer-view')
@login_required
def register_customer_view():
    return render_template('staffPanel/customerDesk/registerCustomerView.html')



@app.route('/get-customer-list', methods=['POST'])
@login_required
def get_customer_list():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                u.id, u.full_name, u.email, u.mobile_number, u.gender, u.dob, u.profile_image,
                u.address, u.city, ud.aadhar_card_photo, ud.pan_card_photo, 
                ud.passport_photo, ud.light_bill_photo, ud.status,ud.created_at As date
            FROM users u
            JOIN user_details ud ON u.id = ud.user_id
            ORDER BY u.id DESC
        """
        cursor.execute(query)
        customers = cursor.fetchall()
      
        
        # Base paths
        doc_base = '/static/uploads/users/documents'
        profile_base = '/static/uploads/users/profiles'
        
       
        doc_mapping = {
            'aadhar_card_photo': 'aadhar_card',
            'pan_card_photo': 'pan_card',
            'passport_photo': 'passport',
            'light_bill_photo': 'light_bill'
        }

        for row in customers:
          
            if row.get('profile_image'):
                row['profile_image'] = f"/{profile_base}/{row['profile_image']}"
            
           
            for field, folder in doc_mapping.items():
                if row.get(field):
                   
                    row[field] = f"{doc_base}/{folder}/{row[field]}"
                   
                else:
                    row[field] = None
        
        cursor.close()
        conn.close()
        
        customers=inject_application_numbers(customers,"customer")
        return jsonify({
            "success": True, 
            "customer_items": customers
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route('/search-customers', methods=['POST'])
@login_required
def search_customers():
    try:
        data = request.get_json(silent=True) or {}
        query_val = data.get('query', '')
        search_query = str(query_val).strip() if not isinstance(query_val, dict) else ''
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        sql = """
            SELECT 
                u.id, u.full_name, u.email, u.mobile_number, u.gender, u.dob, u.profile_image,
                u.address, u.city, ud.status, ud.created_at AS date
            FROM users u
            JOIN user_details ud ON u.id = ud.user_id
        """
        
        params = []
        where_clause = ""

        if search_query:
            if 'CN-' in search_query:
                if bool(re.match(r"^CN-\d{6}-\d{6}-\d+$", search_query)):
                    where_clause = " WHERE ud.created_at = %s AND u.id = %s"
                    params = (get_transaction_time(search_query), search_query.split('-')[-1])
                else:
                    return jsonify({"success": True, "customer_items": []})
            else:
                where_clause = """ 
                    WHERE (u.full_name LIKE %s 
                    OR u.email LIKE %s 
                    OR ud.city LIKE %s 
                    OR u.mobile_number LIKE %s)
                """
                like_val = f"%{search_query}%"
                params = [like_val, like_val, like_val, like_val]
        
        final_sql = sql + where_clause + " ORDER BY u.id DESC"
        cursor.execute(final_sql, params)
        customers = cursor.fetchall()

        for row in customers:
            if row.get('dob'):
                row['dob'] = str(row['dob']).split(' ')[0]

        cursor.close()
        conn.close()
        
        customers=inject_application_numbers(customers,"customer")
        return jsonify({"success": True, "customer_items": customers})

    except Exception as e:
        return jsonify({"success": False, "message": "Internal server error"})


@app.route('/delete-customer', methods=['POST'])
@login_required
def delete_customer():
    data = request.get_json()
    customer_id = data.get('id')
    
    if not customer_id:
        return jsonify({"success": False, "message": "Customer ID missing"})
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        doc_query = """
            SELECT aadhar_card_photo, pan_card_photo, passport_photo, light_bill_photo 
            FROM user_details WHERE user_id = %s
        """
        cursor.execute(doc_query, (customer_id,))
        doc_record = cursor.fetchone()

        cursor.execute("SELECT profile_image FROM users WHERE id = %s", (customer_id,))
        user_record = cursor.fetchone()

        cursor.execute("DELETE FROM user_details WHERE user_id = %s", (customer_id,))
        cursor.execute("DELETE FROM users WHERE id = %s", (customer_id,))
        
        conn.commit()

        if doc_record:
            base_path = 'static/uploads/users/documents/'
            doc_folders = {
                'aadhar_card_photo': 'aadhar_card',
                'pan_card_photo': 'pan_card',
                'passport_photo': 'passport',
                'light_bill_photo': 'light_bill'
            }

            for col_name, folder in doc_folders.items():
                filename = doc_record.get(col_name)
                if filename:
                    file_path = os.path.join(base_path, folder, filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)

        if user_record and user_record.get('profile_image'):
            profile_filename = user_record.get('profile_image')
            
            if profile_filename != "default-user-image.png":
                profile_path = os.path.join('static/uploads/users/profiles/', profile_filename)
                if os.path.exists(profile_path):
                    os.remove(profile_path)

        return jsonify({"success": True, "message": "Customer, Profile, and Documents Deleted Successfully"})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn:
            cursor.close()
            conn.close()



@app.route('/customers/<int:user_id>/update', methods=['POST'])
@login_required
def update_customer_details(user_id):
    conn = None
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        update_users_query = """
            UPDATE users 
            SET full_name = %s, mobile_number = %s, email = %s, gender = %s, dob = %s,
            city = %s, address = %s 
            WHERE id = %s
        """
        users_params = (
            data.get('name'),
            data.get('mobile'),
            data.get('email'),
            data.get('gender'),
            data.get('dob'),
            data.get('city'),
            data.get('address'),
            user_id
        )
        cursor.execute(update_users_query, users_params)
        user_updated = cursor.rowcount
        
        conn.commit()
    
        if user_updated == 0:
            return jsonify({"success": False, "message": "No Changes Made"}), 404

        return jsonify({
            "success": True, 
            "message": "Customer Record Updated Successfully"
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()


@app.route('/customers/<int:user_id>/update-docs', methods=['POST'])
@login_required
def update_customer_documents(user_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        base_path = 'static/uploads/users/documents/'
        doc_mapping = {
            'aadhar_card_photo': 'aadhar_card',
            'pan_card_photo': 'pan_card',
            'passport_photo': 'passport',
            'light_bill_photo': 'light_bill'
        }

        cursor.execute("SELECT * FROM user_details WHERE user_id = %s", (user_id,))
        current_record = cursor.fetchone()

        if not current_record:
            return jsonify({"success": False, "message": "User Details Not Found"}), 404

        updates = []
        params = []
        timestamp = int(time.time())

        for form_key, folder_name in doc_mapping.items():
            file = request.files.get(form_key)
            
            if file and file.filename != '':
                # Delete Old File if exists
                old_filename = current_record.get(form_key)
                if old_filename:
                    old_path = os.path.join(base_path, folder_name, old_filename)
                    if os.path.exists(old_path):
                        os.remove(old_path)

                # Save New File
                _, ext = os.path.splitext(file.filename)
                ext = ext.lower()
                
                target_dir = os.path.join(base_path, folder_name)
                if not os.path.exists(target_dir):
                    os.makedirs(target_dir)

                new_filename = f"user_{user_id}_{folder_name}_{timestamp}{ext}"
                save_path = os.path.join(target_dir, new_filename)
                
                file.save(save_path)
                
                updates.append(f"{form_key} = %s")
                params.append(new_filename)

        if not updates:
            return jsonify({"success": False, "message": "No files selected for upload"})

        params.append(user_id)
        sql = f"UPDATE user_details SET {', '.join(updates)}, status='pending' WHERE user_id = %s"
        
        cursor.execute(sql, tuple(params))
        conn.commit()

        return jsonify({
            "success": True, 
            "message": "Documents Updated Successfully"
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn:
            cursor.close()
            conn.close()


# Document Verification
@app.route('/document-verification-view')
@login_required
def document_verification_view():
    return render_template('staffPanel/customerDesk/documentVerificationView.html')



@app.route('/get-document-verification-status', methods=['POST'])
@login_required
def get_document_verification_status():
    try:
      
        data = request.json or {}
        print(data)
        search_query = data.get('q','').strip() if data else ''
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
         
        
        sql = """
            SELECT 
                u.id, u.full_name, u.email, u.mobile_number, u.dob,
                u.city, u.address, ud.status,
                ud.aadhar_card_photo, ud.pan_card_photo, 
                ud.passport_photo, ud.light_bill_photo, ud.created_at AS date
            FROM users u
            JOIN user_details ud ON u.id = ud.user_id
        """
        
        params = []
        
      
        if search_query:
            
             if 'VN-' in search_query:
                 if bool(re.match(r"^VN-\d{6}-\d{6}-\d+$", search_query)):
                    sql+=" AND ud.created_at=%s AND ud.user_id=%s"
                    print(get_transaction_time(search_query))
                    params=(get_transaction_time(search_query),f"{search_query.split('-')[-1]}")
                    
                 else:
                     return jsonify([]) 
             else:
                sql += """ 
                    WHERE (u.full_name LIKE %s 
                    OR u.email LIKE %s 
                    OR u.mobile_number LIKE %s)
                """
                params = [f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"]

        else:
            sql += " ORDER BY u.id DESC"
            
        cursor.execute(sql, params)
        customers = cursor.fetchall()
        
        if customers:
        
            doc_base = '/static/uploads/users/documents'
            doc_mapping = {
                'aadhar_card_photo': 'aadhar_card',
                'pan_card_photo': 'pan_card',
                'passport_photo': 'passport',
                'light_bill_photo': 'light_bill'
            }

            for row in customers:
               
                if row.get('dob'):
                    row['dob'] = str(row['dob']).split(' ')[0]
                    
                for field, folder in doc_mapping.items():
                    if row.get(field):
                        row[field] = f"{doc_base}/{folder}/{row[field]}"
                    else:
                        row[field] = None
            
            cursor.close()
            conn.close()
            
           
            customers = inject_application_numbers(customers, "verification")
            
            return jsonify({
                "success": True, 
                "customer_items": customers
            })
            
        else: return jsonify({"success": False, "message":"Data Not Available"})
                
    except Exception as e:
        print(e)
        return jsonify({"success": False, "message": str(e)})



# Gold Loan Price Set
@app.route('/gold-price-settings')
@login_required
def gold_price_settings():
    return render_template('staffPanel/customerDesk/goldPriceSettings.html')


@app.route('/get-gold-price', methods=['POST'])
@login_required
def get_gold_price():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT id FROM loan_type WHERE name = 'Gold Loan' LIMIT 1")
        loan_result = cursor.fetchone()
        
        if not loan_result:
            return jsonify({"success": False, "message": "Loan type 'Gold Loan' not found"})
            
        loan_id = loan_result["id"]
        
        cursor.execute("SELECT gram_price,is_realtime FROM gold_price WHERE loan_id = %s LIMIT 1", (loan_id,))
        result = cursor.fetchone()
        
        if result:
            
            if result['is_realtime'] == 1:
                
                try:
                    
                 result['gram_price']=extract_gold_price()      
                except Exception as e:
                    cursor.execute(
                            "UPDATE gold_price SET is_realtime = %s WHERE loan_id = %s", 
                            (0, loan_id)
                        )
                    conn.commit()
                    return jsonify({"success": False, "message": "Price Fetching Issue"})
                
            
            return jsonify({
                "success": True,
                "price": result['gram_price'],
                "is_realtime": result['is_realtime']
            })
            
        return jsonify({"success": False, "message": "Valuation record not found"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
        
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/update-gold-price', methods=['POST'])
@login_required
def update_gold_price():
    conn = None
    try:
        data = request.get_json()
        new_price = data.get('price')

        if new_price is None:
            return jsonify({"success": False, "message": "Price is required"})
        
        try:
            new_price = float(new_price)
            if new_price < 0:
                raise ValueError
        except ValueError:
            return jsonify({"success": False, "message": "Invalid price value"})

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT id FROM loan_type WHERE name = 'Gold Loan' LIMIT 1")
        result = cursor.fetchone()
        
        if not result:
            return jsonify({"success": False, "message": "Loan type 'Gold Loan' not found in database"})
        
        loan_id = result["id"]
        
        query = "UPDATE gold_price SET gram_price = %s WHERE loan_id = %s"
        cursor.execute(query, (new_price, loan_id))
        conn.commit()

        return jsonify({
            "success": True, 
            "message": "Gold price updated successfully"
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"})
    
    finally:
        if conn:
            cursor.close()
            conn.close()



@app.route('/update-sync-status', methods=['POST'])
def update_sync_status():
    conn = None
    try:
        # 1. Parse the incoming JSON data
        data = request.json
        is_realtime = 1 if data.get('is_realtime') else 0
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 2. Identify the 'Gold Loan' ID first to ensure we update the correct row
        cursor.execute("SELECT id FROM loan_type WHERE name = 'Gold Loan' LIMIT 1")
        loan_result = cursor.fetchone()
        
        if not loan_result:
            return jsonify({"success": False, "message": "Loan type 'Gold Loan' not found"})
            
        loan_id = loan_result["id"]
        
        # 3. Update the sync status (is_realtime flag)
        cursor.execute(
            "UPDATE gold_price SET is_realtime = %s WHERE loan_id = %s", 
            (is_realtime, loan_id)
        )
        conn.commit()
        
        return jsonify({
            "success": True, 
            "message": f"Auto-sync turned {'ON' if is_realtime else 'OFF'}"
        })

    except Exception as e:
        # Rollback in case of database errors
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": str(e)})
        
    finally:
        # 4. Clean up connection
        if conn:
            cursor.close()
            conn.close()


# Loan Requests

# Gold Loan
@app.route('/gold-loan-request')
@login_required
def gold_loan_request():
    return render_template('staffPanel/loanRequest/goldLoanRequest.html')


@app.route('/gold-loan-requests-list', methods=['POST'])
@login_required
def gold_loan_requests_list(): 
    conn = None 
    try:
        data = request.get_json() or {}
        search_query = str(data.get('q', '')).strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        sql = """
            SELECT gl.id, gl.customer_id, u.full_name AS name, u.mobile_number AS phone, 
                   u.email, gl.monthly_emi AS loan_emi, gl.gold_weight, gl.processing_fee, gl.loan_amount, 
                   gl.expected_month, gl.status, gl.description, gl.date, 
                   glt.item_name AS gold_type, glp.purity AS gold_purity, gl.gram_per_price AS gram_price, 
                   gl.appointment_date, gl.appointment_time, gl.customer_status, 
                   gl.estimated_amount, gl.credit_score,gl.interest_rate
            FROM gold_loan_request gl
            LEFT JOIN users u ON gl.customer_id = u.id
            LEFT JOIN loan_type lt ON gl.gold_loan_id = lt.id
            LEFT JOIN gold_type glt ON gl.gold_loan_type_id = glt.id
            LEFT JOIN gold_purity glp ON gl.gold_loan_purity_id = glp.id  
            WHERE gl.status in ('pending', 'approved', 'rejected')
        """
        
        params = []
        where_clause = ""

        if search_query:
            if 'GL-' in search_query:
                
                if bool(re.match(r"^GL-\d{6}-\d{6}-\d+$", search_query)):
                    where_clause = "AND gl.date = %s AND gl.id = %s"
                    params = [get_transaction_time(search_query), search_query.split('-')[-1]]
                else:
                    return jsonify([])
            else:
                where_clause = """ AND (u.full_name LIKE %s 
                                   OR u.email LIKE %s 
                                   OR u.mobile_number LIKE %s) """
                params = [f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"]

        
        final_sql = sql + where_clause + " ORDER BY gl.date DESC"
        
        cursor.execute(final_sql, params)
        rows = cursor.fetchall()

        for row in rows:
            for key, value in row.items():
                if isinstance(value, (timedelta, date)):
                    row[key] = str(value)
                if value is None:
                    row[key] = ""
         
         
        rows = inject_application_numbers(rows, 'Gold Loan')
        rows =[{**row, 'apply_date': row.pop('date')} for row in rows if 'date' in row]     
        return jsonify(rows)
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn:
            cursor.close()
            conn.close()
  
    
@app.route('/gold-loan-requests/<int:loan_id>/action', methods=['POST'])
@login_required
def update_loan_status(loan_id):
    conn = None 
    try:
        data = request.get_json()
        action_type = data.get('action') 
        
        description = data.get('reason', '')
        
        reasons = {
            "approve":description if description !=''else "Congratulations! Your Gold Loan application has been approved. Our team has successfully reviewed your request and confirmed your eligibility.",
            "reject": description if description !=''else "The submitted documents or gold details do not meet our standard requirements. Please provide your latest original documents to our staff for physical re-verification."
        }
        
        selected_reason =reasons.get(action_type)
        
        if action_type not in ['approve', 'reject']:
            return jsonify({"success": False, "message": "Invalid Action Type"})

        conn = get_db_connection()   
        cursor = conn.cursor(dictionary=True)
        
        
        info_query = """
            SELECT u.full_name, u.email, gl.date, gl.id
            FROM gold_loan_request gl
            JOIN users u ON gl.customer_id = u.id
            WHERE gl.id = %s
        """
        cursor.execute(info_query, (loan_id,))
        loan_info = cursor.fetchone()

        if not loan_info:
            return jsonify({"success": False, "message": "Loan Request ID Not Found"})

       
        new_status = 'approved' if action_type == 'approve' else 'rejected'
        customer_status='active' if action_type == 'approve' else 'inactive'
        update_query = "UPDATE gold_loan_request SET status = %s, description = %s, customer_status=%s WHERE id = %s"
        cursor.execute(update_query, (new_status, selected_reason, customer_status, loan_id))
        conn.commit()

       
        app_no_data = inject_application_numbers([loan_info], "Gold Loan")
        final_app_no = app_no_data[0]['app_no']

       
        email_status = ""
        try:
            msg = Message(
                subject=f"Gold Loan Application {new_status.capitalize()} - FinTrack",
                sender=app.config['MAIL_USERNAME'],
                recipients=[loan_info['email']]
            )
            
            msg.html = render_template(
                'email/goldLoanRequestStatusEmail.html',
                user_name=loan_info['full_name'],
                status=new_status, 
                app_no=final_app_no,
                reason=selected_reason,
                dashboard_url=url_for('index', _external=True)
            )
            
            mail.send(msg)
            email_status = "And Notification Email Sent."
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}")
            email_status = "But Failed To Send Notification Email."

        return jsonify({
            "success": True, 
            "message": f"Application {new_status.capitalize()} Successfully {email_status}"
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": f"Server Error: {str(e)}"})
        
    finally:
        if conn:
            cursor.close()
            conn.close()

@app.route('/customers/<context>/update-credit', methods=['POST'])
@login_required
def update_credit_score(context):
    conn = None
    try:
        data = request.get_json()
        score = data.get('credit_score')
        userId=data.get('userId')
        loanRequestId=data.get('loanRequestId') if context is not None else None

        if score is None:
            return jsonify({"success": False, "message": "Credit score is required"})
        
        if userId is None:
            return jsonify({"success": False, "message": "User ID is required"})
        
        if context !="profile":
            if loanRequestId is None:
                return jsonify({"success": False, "message": "Loan Request ID is required"})

        conn = get_db_connection()
        cursor = conn.cursor()
        
        
        cursor.execute("UPDATE user_details SET recent_credit_score = %s WHERE user_id = %s", (score, userId))
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({"success": False, "message": "Customer Details Not Found"})
        
        if context=="Gold Loan":
            cursor.execute("UPDATE gold_loan_request SET credit_score = %s WHERE id = %s", (score, loanRequestId))
            conn.commit()
        
        if context=="Bike Loan":
            cursor.execute("UPDATE bike_loan_request SET credit_score = %s WHERE id = %s", (score, loanRequestId))
            conn.commit()
            
        return jsonify({"success": True, "message": "Credit Score Updated Successfully"})

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": str(e)})
        
    finally:
        if conn:
            cursor.close()
            conn.close()


# Bike Loan

@app.route('/bike-loan-request')
@login_required
def bike_loan_request():
    return render_template('staffPanel/loanRequest/bikeLoanRequest.html')
  
  
@app.route('/bike-loan-requests-list', methods=['POST'])
@login_required
def bike_loan_requests_list(): 
    conn = None 
    try:
        data = request.get_json(silent=True) or {}
        search_query = str(data.get('q', '')).strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id FROM loan_type WHERE name = 'Bike Loan' LIMIT 1")
        category = cursor.fetchone()
        
        if not category:
            return jsonify([])
        
        bike_loan_type_id = category['id']

    
        sql = """
            SELECT 
                bl.*, 
                u.full_name AS name, u.mobile_number AS phone, u.email,
                bm.bike_name, bm.company_name, bm.enginecc, bm.fuel_type, bm.on_road_price,
                bl.credit_score, bl.date,bl.interest_rate,bm.on_road_price,bl.down_payment
            FROM bike_loan_request bl
            LEFT JOIN users u ON bl.customer_id = u.id
            LEFT JOIN bike_master bm ON bl.bike_id = bm.id
            WHERE bm.loan_id = %s AND bl.status in ('pending', 'approved', 'rejected')
        """
        
        params = [bike_loan_type_id]

       
        if search_query:
            if 'BL-' in search_query:
               
                if bool(re.match(r"^BL-\d{6}-\d{6}-\d+$", search_query)):
                    sql += " AND bl.date = %s AND bl.id = %s"
                    params.extend([get_transaction_time(search_query), search_query.split('-')[-1]])
                else:
                    return jsonify([])
            else:
               
                sql += " AND (u.full_name LIKE %s OR u.mobile_number LIKE %s OR u.email LIKE %s)"
                like_val = f"%{search_query}%"
                params.extend([like_val, like_val, like_val])

      
        sql += " ORDER BY bl.date DESC"
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        
        
        for row in rows:
            for key, value in row.items():
                if isinstance(value, (timedelta, date)):
                    row[key] = str(value)
                if value is None:
                    row[key] = ""
                    
        rows = inject_application_numbers(rows, "Bike Loan")
        return jsonify(rows)

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()



@app.route('/bike-loan-requests/<int:loan_id>/action', methods=['POST'])
@login_required
def update_bike_loan_status(loan_id):
    conn = None 
    try:
        data = request.get_json()
        action_type = data.get('action')
        description = data.get('reason', '')
       
        reasons = {
            "approve": description if description !='' else "Excellent news! Your Bike Loan has been sanctioned. You are one step closer to riding your new bike.",
            "reject":  description if description!='' else "We regret to inform you that your application does not meet our current eligibility criteria. Please provide your latest original documents to our staff for physical re-verification."
        }
        
        selected_reason = reasons.get(action_type)
        
        if action_type not in ['approve', 'reject']:
            return jsonify({"success": False, "message": "Invalid Action Type"})

        conn = get_db_connection()
        if not conn:
            return jsonify({"success": False, "message": "Database Connection Failed"})
            
        cursor = conn.cursor(dictionary=True) 
        
       
        info_query = """
            SELECT u.full_name, u.email, bl.date, bl.id
            FROM bike_loan_request bl
            JOIN users u ON bl.customer_id = u.id
            LEFT JOIN bike_master bm ON bl.bike_id = bm.id
            WHERE bl.id = %s
        """
        cursor.execute(info_query, (loan_id,))
        loan_info = cursor.fetchone()

        if not loan_info:
            return jsonify({"success": False, "message": "Loan Request Not Found"})

       
        new_status = 'approved' if action_type == 'approve' else 'rejected'
        customer_status='active' if action_type == 'approve' else 'inactive'
        update_query = "UPDATE bike_loan_request SET status = %s, description = %s, customer_status=%s WHERE id = %s"
        cursor.execute(update_query, (new_status, selected_reason,customer_status, loan_id))
        conn.commit()

       
        app_no_data = inject_application_numbers([loan_info], "Bike Loan")
        final_app_no = app_no_data[0]['app_no']

        
        email_status = ""
        try:
            msg = Message(
                subject=f"Bike Loan Application {new_status.capitalize()} - FinTrack",
                sender=app.config['MAIL_USERNAME'],
                recipients=[loan_info['email']]
            )
            
            msg.html = render_template(
                'email/bikeLoanRequestStatusEmail.html',
                user_name=loan_info['full_name'],
                status=new_status,
                app_no=final_app_no,
                reason=selected_reason,
               
                dashboard_url=url_for('index', _external=True)
            )
            
            mail.send(msg)
            email_status = "And Notification Email Sent."
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}")
            email_status = "But Failed To Send Notification Email."

        return jsonify({
            "success": True, 
            "message": f"Bike Loan {new_status.capitalize()} Successfully {email_status}"
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn:
            cursor.close()
            conn.close()
    

# User Panel 

# Profile

# Profile Image
@app.route('/upload-user-profile', methods=['POST'])
@login_required
def upload_user_profile():

    if 'user_image' not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400

    file = request.files['user_image']
    user_id = session.get('user_id')

    if file.filename == '':
        return jsonify({"success": False, "message": "No selected file"}), 400

    if file:
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            cursor.execute("SELECT profile_image FROM users WHERE id = %s", (user_id,))
            old_record = cursor.fetchone()
            
            if old_record and old_record['profile_image'] and old_record['profile_image'] != "default-user-image.png":
                old_path = os.path.join('static/uploads/users/profiles/', old_record['profile_image'])
                if os.path.exists(old_path):
                    os.remove(old_path)

            filename = secure_filename(f"user_{user_id}_{file.filename}")
            file_path = os.path.join('static/uploads/users/profiles/', filename)
            file.save(file_path)

            cursor.execute("UPDATE users SET profile_image = %s WHERE id = %s", (filename, user_id))
            conn.commit()

            new_url = f"/static/uploads/users/profiles/{filename}"
            session['profile_image'] = new_url

            return jsonify({
                "success": True, 
                "message": "Profile updated!", 
                "new_url": new_url
            })

        except Exception as e:
            if conn: conn.rollback()
            return jsonify({"success": False, "message": str(e)}), 500
        finally:
            if conn:
                cursor.close()
                conn.close()
    
    return jsonify({"success": False, "message": "File upload failed"}), 400


# Update Credentials
@app.route('/update-user-credentials', methods=['POST'])
@login_required
def update_user_credentials():

    new_password = request.form.get('password')
    user_id = session.get('user_id')

    ph=PasswordHasher()
    hashed_password=ph.hash(new_password)
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
      
        cursor.execute("SELECT is_temp FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        

        if user_data:
            if user_data['is_temp'] == 1:
                query = "UPDATE users SET password = %s, is_temp = 0 WHERE id = %s"
                cursor.execute(query, (hashed_password, user_id))
                session['is_temp'] = 0
            else:
                query = "UPDATE users SET password = %s WHERE id = %s"
                cursor.execute(query, (hashed_password, user_id))

            conn.commit()
            return jsonify({"success": True, "message": "Credentials Updated Successfully!"})
        
        return jsonify({"success": False, "message": "User Not Found"}), 404

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


# Update Profile
@app.route('/update-profile', methods=['POST'])
@login_required
def update_profile():
   
    data = request.get_json()
    user_id = session.get('user_id')
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

       
        query = """
            UPDATE users 
            SET full_name = %s, 
                mobile_number = %s, 
                gender = %s, 
                dob = %s, 
                city = %s, 
                address = %s 
            WHERE id = %s
        """
        
        values = (
            data.get('full_name'),
            data.get('mobile'),
            data.get('gender'),
            data.get('dob'),
            data.get('city'),
            data.get('address'),
            user_id
        )

        cursor.execute(query, values)
        conn.commit()
        
        session.update({
            'user_name': data.get('full_name'),
            'mobile': data.get('mobile'),
            'gender': data.get('gender'),
            'dob':  data.get('dob'),
            'city': data.get('city'),
            'address': data.get('address')
        })

        return jsonify({"message": "Profile Updated successfully"}), 200
    
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"MySQL Error: {str(e)}")
        return jsonify({"error": "Database update failed"}), 500

    finally:
        if conn:
            conn.close()



# Dashboard
@app.route("/user-dashboard")
@login_required
def user_dashboard():
    now = datetime.now()
    formatted_date = now.strftime("%B %d, %Y")
    return render_template("userPanel/dashboard.html",today=formatted_date)





@app.route('/dashboard-data')
@login_required 
def get_dashboard_data():
    user_id = session.get('user_id')
    now = datetime.now() # March 22, 2026
    conn = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. User Info
        cursor.execute("SELECT recent_credit_score FROM user_details WHERE user_id = %s", (user_id,))
        u_info = cursor.fetchone()
        credit_score = u_info['recent_credit_score'] if u_info else 0

        # 2. Summary Statistics
        cursor.execute("""
            SELECT 
                (SELECT COUNT(*) FROM bike_loan_request WHERE customer_id = %s AND status = 'approved' AND customer_status='active') +
                (SELECT COUNT(*) FROM gold_loan_request WHERE customer_id = %s AND status = 'approved' AND customer_status='active') 
                as total_count,
                (SELECT COALESCE(SUM(final_amount), 0) FROM bike_loan_request WHERE customer_id = %s AND status = 'approved' AND customer_status='active') +
                (SELECT COALESCE(SUM(loan_amount), 0) FROM gold_loan_request WHERE customer_id = %s AND status = 'approved' AND customer_status='active') 
                as total_principal
        """, (user_id, user_id, user_id, user_id))
        stats = cursor.fetchone() or {'total_count': 0, 'total_principal': 0}
        
        # 3. Payment Totals
        cursor.execute("""
            SELECT COALESCE(SUM(paid_amount), 0) as total_paid 
            FROM (
                SELECT COALESCE(SUM(be.emi_amount), 0) as paid_amount 
                FROM bike_loan_emi be 
                JOIN bike_loan_request bl ON be.bike_loan_request_id=bl.id 
                WHERE bl.customer_id = %s AND bl.customer_status='active' AND be.status='paid'
                UNION ALL
                SELECT COALESCE(SUM(ge.emi_amount), 0) as paid_amount 
                FROM gold_loan_emi ge 
                JOIN gold_loan_request gl ON ge.gold_loan_request_id=gl.id 
                WHERE gl.customer_id = %s AND gl.customer_status = 'active' AND ge.status='paid'
            ) AS combined_payments
        """, (user_id, user_id))
        p_stats = cursor.fetchone()
        total_paid_val = float(p_stats['total_paid'] or 0) if p_stats else 0
        outstanding = float(stats['total_principal'] or 0) - total_paid_val

        # 4. Next Due Date Calculation
        cursor.execute("""
           SELECT MIN(upcoming_date) as next_due
            FROM (
                SELECT 
                    CASE 
                        -- 1. Compare Year and Month together (e.g., '2026-04' > '2026-04')
                        -- If the appointment is already scheduled for a FUTURE month/year, leave it alone.
                        WHEN DATE_FORMAT(appointment_date, '%Y-%m') > DATE_FORMAT(CURDATE(), '%Y-%m') 
                        THEN appointment_date
                        
                        -- 2. If the appointment is in the CURRENT month (or past), 
                        -- always jump to the same day in the NEXT month.
                        ELSE DATE_ADD(DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01'), INTERVAL (DAY(appointment_date) - 1) DAY)
                    END AS upcoming_date 
                FROM bike_loan_request 
                WHERE customer_id = %s AND status = 'approved' AND customer_status = 'active'

                UNION ALL

                SELECT 
                    CASE 
                        -- Same logic for Gold Loan
                        WHEN DATE_FORMAT(appointment_date, '%Y-%m') > DATE_FORMAT(CURDATE(), '%Y-%m') 
                        THEN appointment_date
                        
                        ELSE DATE_ADD(DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01'), INTERVAL (DAY(appointment_date) - 1) DAY)
                    END AS upcoming_date 
                FROM gold_loan_request 
                WHERE customer_id = %s AND status = 'approved' AND customer_status = 'active'
            ) AS all_schedules
        """, (user_id, user_id))
        
        d_res = cursor.fetchone()
        d_res['next_due'] =   datetime.strptime(d_res['next_due'], "%Y-%m-%d") if d_res and d_res['next_due'] else None
        next_due = d_res['next_due'].strftime("%B %d") if d_res and d_res['next_due'] else "No Schedule"
      
        # 5. Loan List Processing
        cursor.execute("""
            SELECT br.id, bm.bike_name AS name, br.final_amount AS loan_amount, 
                   br.monthly_emi, br.status, br.date, br.appointment_date, 
                   br.expected_month, 'Bike' AS loan_type 
            FROM bike_loan_request br JOIN bike_master bm ON br.bike_id = bm.id
            WHERE br.customer_id = %s AND br.status = 'approved' AND br.customer_status = 'active' ORDER BY date DESC
        """, (user_id,))
        bike_loans = inject_application_numbers(cursor.fetchall(), 'bike loan')

        cursor.execute("""
            SELECT gr.id, gt.item_name AS name, gr.loan_amount AS loan_amount, 
                   gr.monthly_emi, gr.status, gr.date, gr.appointment_date, 
                   gr.expected_month, 'Gold' AS loan_type 
            FROM gold_loan_request gr JOIN gold_type gt ON gr.gold_loan_id = gt.id
            WHERE gr.customer_id = %s AND gr.status = 'approved' AND gr.customer_status = 'active' ORDER BY date DESC
        """, (user_id,))
        gold_loans = inject_application_numbers(cursor.fetchall(), 'gold loan')

        # EMI Breakdown Maps
        cursor.execute("SELECT bike_loan_request_id, SUM(emi_amount) as amt, COUNT(*) as cnt FROM bike_loan_emi WHERE status = 'paid' GROUP BY bike_loan_request_id")
        b_paid = {r['bike_loan_request_id']: r for r in cursor.fetchall()}
        cursor.execute("SELECT gold_loan_request_id, SUM(emi_amount) as amt, COUNT(*) as cnt FROM gold_loan_emi WHERE status = 'paid' GROUP BY gold_loan_request_id")
        g_paid = {r['gold_loan_request_id']: r for r in cursor.fetchall()}

        # NEW: Fetch loans paid in the CURRENT MONTH only

        cursor.execute("""
            SELECT ble.bike_loan_request_id, blr.appointment_date 
            FROM bike_loan_emi ble
            INNER JOIN bike_loan_request blr ON ble.bike_loan_request_id = blr.id
            WHERE MONTH(ble.due_date) = %s 
            AND YEAR(ble.due_date) = %s 
            AND ble.status = 'paid'
            AND blr.customer_id = %s
        """, (now.month, now.year, user_id))
        
        b_paid_this_month = {r['bike_loan_request_id'] for r in cursor.fetchall()}
       
        
        cursor.execute("""
            SELECT gle.gold_loan_request_id, glr.appointment_date 
            FROM gold_loan_emi gle
            INNER JOIN gold_loan_request glr ON gle.gold_loan_request_id = glr.id
            WHERE MONTH(gle.due_date) = %s 
            AND YEAR(gle.due_date) = %s 
            AND gle.status = 'paid'
            AND glr.customer_id = %s
        """, (now.month, now.year, user_id))
        
    
        g_paid_this_month = {r['gold_loan_request_id'] for r in cursor.fetchall()}
        
        
        loans_raw = bike_loans + gold_loans
        loans_raw.sort(key=lambda x: x['date'], reverse=True)

        formatted_loans = []
        for loan in loans_raw:
            l_id = loan['id']
            principal = float(loan['loan_amount'])
            
            p_data = b_paid.get(l_id, {'amt': 0, 'cnt': 0}) if loan['loan_type'] == 'Bike' else g_paid.get(l_id, {'amt': 0, 'cnt': 0})
            
            # Determine if this specific loan is in our "Paid this month" sets
            paid_now = (l_id in b_paid_this_month) if loan['loan_type'] == 'Bike' else (l_id in g_paid_this_month)
            is_loan_issue_month = loan['appointment_date'] and loan['appointment_date'].month == now.month and loan['appointment_date'].year == now.year
            
            due_day = "TBD"
            if loan['appointment_date']:
                d = loan['appointment_date'].day
                suffix = 'th' if 11 <= d <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(d % 10, 'th')
                due_day = f"{d}{suffix}"

            formatted_loans.append({
                "type": loan['loan_type'],
                "name": loan['name'],
                "id": loan['app_no'],
                "loan_amount": principal,
                "emi": float(loan['monthly_emi'] or 0),
                "due": f"{due_day} of month",
                "current_oustanding": f"₹{int(principal - float(p_data['amt'])):,}",
                "installments": f"{str(p_data['cnt']).zfill(2)} / {str(loan['expected_month'] or 0).zfill(2)}",
                "is_paid_this_month": paid_now,  # Sent to frontend for badge logic
                "is_loan_issue_month": is_loan_issue_month  # Sent to frontend for badge logic
            })
            
       
        cursor.execute("SELECT balance FROM digital_wallet WHERE customer_id = %s", (user_id,))
        result = cursor.fetchone()
        wallet_balance = float(result['balance']) if result and result['balance'] is not None else 0.00
       
        return jsonify({
            "status": "success",
            "summary": {
                "credit_score": credit_score,
                "wallet_balance":wallet_balance,
                "outstanding": outstanding,
                "count": stats['total_count'],
                "next_emi_date": next_due 
            },
            "loans": formatted_loans
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()




@app.route('/api/admin/stats')
# @login_required (uncomment if using login)
def get_admin_graph_data():
    year = int(request.args.get('year', datetime.now().year))
    month = request.args.get('month', 'all')
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        labels = []
        loan_series = []
        user_series = []
        staff_series = []

        if month == 'all':
            # --- YEARLY VIEW (Grouping by Month) ---
            labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            for m in range(1, 13):
                # 1. Loan Volume (Combining Bike and Gold Loan final amounts) [cite: 18, 38]
                cursor.execute("""
                    SELECT 
                        (SELECT COALESCE(SUM(final_amount), 0) FROM bike_loan_request WHERE YEAR(date) = %s AND MONTH(date) = %s AND status='approved') +
                        (SELECT COALESCE(SUM(loan_amount), 0) FROM gold_loan_request WHERE YEAR(date) = %s AND MONTH(date) = %s AND status='approved') 
                    as total_vol""", (year, m, year, m))
                loan_series.append(float(cursor.fetchone()['total_vol'] or 0))

                # 2. New User Registrations [cite: 80, 93]
                cursor.execute("SELECT COUNT(*) as count FROM user_details WHERE YEAR(`created_at`) = %s AND MONTH(`created_at`) = %s", (year, m))
                user_series.append(cursor.fetchone()['count'])

                # 3. Staff Onboarding 
                cursor.execute("SELECT COUNT(*) as count FROM staff WHERE YEAR(joining_date) = %s AND MONTH(joining_date) = %s", (year, m))
                staff_series.append(cursor.fetchone()['count'])
        else:
            # --- MONTHLY VIEW (Grouping by Day) ---
            m_idx = int(month)
            days = calendar.monthrange(year, m_idx)[1]
            labels = [str(i) for i in range(1, days + 1)]
            for d in range(1, days + 1):
                cursor.execute("""
                    SELECT 
                        (SELECT COALESCE(SUM(final_amount), 0) FROM bike_loan_request WHERE YEAR(date) = %s AND MONTH(date) = %s AND DAY(date) = %s AND status='approved') +
                        (SELECT COALESCE(SUM(loan_amount), 0) FROM gold_loan_request WHERE YEAR(date) = %s AND MONTH(date) = %s AND DAY(date) = %s AND status='approved') 
                    as total_vol""", (year, m_idx, d, year, m_idx, d))
                loan_series.append(float(cursor.fetchone()['total_vol'] or 0))

                cursor.execute("SELECT COUNT(*) as count FROM user_details WHERE YEAR(`created_at`) = %s AND MONTH(`created_at`) = %s AND DAY(`created_at`) = %s", (year, m_idx, d))
                user_series.append(cursor.fetchone()['count'])

                cursor.execute("SELECT COUNT(*) as count FROM staff WHERE YEAR(joining_date) = %s AND MONTH(joining_date) = %s AND DAY(joining_date) = %s", (year, m_idx, d))
                staff_series.append(cursor.fetchone()['count'])

        # --- 4. KYC STATUS (Distribution)  ---
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM user_details
        """)
        kyc = cursor.fetchone() or {'approved': 0, 'pending': 0, 'rejected': 0}

        return jsonify({
            "labels": labels,
            "loans": loan_series,
            "users": user_series,
            "staff": staff_series,
            "kyc": [int(kyc['approved'] or 0), int(kyc['pending'] or 0), int(kyc['rejected'] or 0)]
        })

    finally:
        cursor.close()
        conn.close()



# Account Management | Document Status
@app.route('/document-status')
@login_required
def document_status():
    return render_template('userPanel/accountManagement/documentStatus.html')



@app.route('/get-customer-document-verification-status')
@login_required
def get_customer_verification_status():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        user_id = session.get('user_id')
        cursor.execute("SELECT * FROM user_details WHERE user_id = %s", (user_id,))
        kyc_data = cursor.fetchone()
        
        if not kyc_data:
            return jsonify({"success": False, "message": "No document records found"}), 404

        return jsonify({
            "success": True, 
            "kyc_data": kyc_data
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
        
    finally:
        if conn:
            cursor.close()
            conn.close()


# Account Management | Gold Loan Calculator
@app.route('/gold-loan-calculator')
@login_required
def gold_loan_calculator():
    conn = None
    context = {
        'gold_types': [],
        'purities': [],
        'gram_price': 0,
        'interest_rate': 0
    }
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT item_name FROM gold_type")
        context['gold_types'] = cursor.fetchall()
        
        cursor.execute("SELECT purity FROM gold_purity")
        context['purities'] = cursor.fetchall()
        
        sql_rates = """
            SELECT gp.gram_price,gp.is_realtime, s.interest_spread 
            FROM gold_price gp
            JOIN loan_type lt ON gp.loan_id = lt.id
            JOIN spread_settings s ON s.loan_id = lt.id
            WHERE lt.name = 'Gold Loan' 
            LIMIT 1
        """
        cursor.execute(sql_rates)
        rates = cursor.fetchone()
        
        if rates:
            if rates['is_realtime'] == 1:
               
                
                try:
                    context['gram_price'] = extract_gold_price()
                        
                except Exception as e:
                    context['gram_price'] = rates['gram_price']
                    cursor.execute(
                            "UPDATE gold_price SET is_realtime = %s", 
                            (0,)
                        ) 
                    conn.commit()  
                    print(f"Price Fetch Error : {e}")
            
            else:
                 context['gram_price'] = rates['gram_price']
            print(f"Interest Spread from DB: {rates['interest_spread']}")

            context['interest_rate'] = float(rates['interest_spread'])+float(extract_repo_rate())

    except Exception as e:
        print(f"Error: {str(e)}")
        
    finally:
        if conn:
            cursor.close()
            conn.close()
            
    return render_template('userPanel/accountManagement/goldLoanCalculator.html', **context)


# Bike Loan Calculator
@app.route('/bike-loan-calculator')
@login_required
def bike_loan_calculator():
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """SELECT sp.interest_spread FROM spread_settings sp JOIN loan_type lt 
        ON sp.loan_id =lt.id WHERE name=%s"""
        cursor.execute(query, ("Bike Loan",))
        row=cursor.fetchone()
        interest_rate=float(row['interest_spread'])+float(extract_repo_rate()) if row else 0
        
    except Exception as e:
       
        print(f"SQL Error: {str(e)}")
        interest_rate=0

    finally:
        if conn:
            conn.close()
            cursor.close()
    return render_template('userPanel/accountManagement/bikeLoanCalculator.html',interest_rate=interest_rate)


@app.route('/get-bikes/<condition>', methods=['POST'])
@login_required
def get_bikes(condition):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT bike_name,id FROM bike_master WHERE bike_type=%s"
        cursor.execute(query, (condition,))
        
        rows = cursor.fetchall()
        bikes = [{"id": row['id'], "name": row['bike_name']} for row in rows]

        return jsonify({"bikes": bikes}), 200
    except Exception as e:
       
        print(f"SQL Error: {str(e)}")
        return jsonify({"error": "Internal Database Error"}), 500

    finally:
       
        if conn:
            conn.close()
            cursor.close()


@app.route('/get-price/model/<selectedModel>', methods=['POST']) 
@login_required   
def get_price(selectedModel):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT on_road_price FROM bike_master WHERE bike_name=%s"
        cursor.execute(query, (selectedModel,))
        
        row = cursor.fetchone()
        price = row['on_road_price']
        
        return jsonify({"price": price}), 200

    except Exception as e:
       
        print(f"SQL Error: {str(e)}")
        return jsonify({"error": "Internal Database Error"}), 500

    finally:
        if conn:
            conn.close()
            cursor.close()
 

# Bike Refinance Calculator
@app.route('/bike-refinance-calculator')
@login_required
def bike_refinance_calculator():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """SELECT sp.interest_spread FROM spread_settings sp JOIN loan_type lt 
        ON sp.loan_id =lt.id WHERE name=%s"""
        cursor.execute(query, ("Bike Loan",))
        row=cursor.fetchone()
        interest_rate=float(row['interest_spread'])+float(extract_repo_rate()) if row else 0
        
    except Exception as e:
       
        print(f"SQL Error: {str(e)}")
        interest_rate=0

    finally:
        if conn:
            conn.close()
            cursor.close()
    return render_template('userPanel/accountManagement/bikeRefinanceCalculator.html',interest_rate=interest_rate) 


# Apply Loan | Gold Loan Request 
@app.route('/request-gold-loan')  
@login_required
def request_gold_loan():
    context = {
        'gold_types': [],
        'purities': [],
        'gram_price': 0,
        'interest_rate': 0,
    }
    
    conn = None
    try:
        conn = get_db_connection()
        
        cursor=conn.cursor(dictionary=True)  
        cursor.execute("SELECT id, item_name FROM gold_type ORDER BY item_name ASC")
        context['gold_types'] = cursor.fetchall()
        
        cursor.execute("SELECT id, purity FROM gold_purity ORDER BY purity DESC")
        context['purities'] = cursor.fetchall()
        
        sql_rates = """
            SELECT 
                COALESCE(gp.gram_price, 0) as gram_price,gp.is_realtime, 
                COALESCE(sp.interest_spread, 0) as interest_spread 
            FROM gold_price gp
            JOIN loan_type lt ON gp.loan_id = lt.id
            JOIN spread_settings sp ON sp.loan_id = lt.id
            WHERE lt.name = 'Gold Loan' 
            LIMIT 1
        """
        cursor.execute(sql_rates)
        rates = cursor.fetchone()
        
        if rates:
            if rates['is_realtime'] == 1:
    
                try:
                    context['gram_price'] = extract_gold_price()
                        
                except Exception as e:
                    context['gram_price'] = rates['gram_price']
                    cursor.execute(
                            "UPDATE gold_price SET is_realtime = %s", 
                            (0,)
                        ) 
                    conn.commit()  
                    print(f"Price Fetch Error : {e}")
            
            else:
                 context['gram_price'] = rates['gram_price']
        
            context['interest_rate'] = float(rates['interest_spread'])+ float(extract_repo_rate()) +float(get_user_reliability_discount())
            
    except Exception as e:
        print(f"Database Error in request_gold_loan: {e}")
        
    finally:
        if conn:
            conn.close()
            cursor.close()

    return render_template('userPanel/applyLoan/goldLoanRequest.html', **context)
    

@app.route('/submit-gold-loan-request', methods=['POST'])
@login_required
@verify_documents
def submit_gold_loan_request():
    data = request.get_json()

    conn = None
    try:
        conn = get_db_connection()
        cursor=conn.cursor(dictionary=True)
          
        cursor.execute("SELECT id FROM loan_type WHERE name='Gold Loan'")
        gold_type_id=cursor.fetchone()['id']
        
        query = """
            INSERT INTO gold_loan_request (
                customer_id, 
                gold_loan_id,
                gold_loan_type_id, 
                gold_loan_purity_id, 
                gold_weight, 
                loan_amount, 
                expected_month, 
                interest_rate,     
                estimated_amount, 
                monthly_emi, 
                gram_per_price, 
                appointment_date, 
                appointment_time
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
      
        customer_id = session.get('user_id', 1) 

        values = (
            customer_id,
            gold_type_id,
            data.get('gold_type_id'),
            data.get('gold_loan_purity_id'),
            data.get('weight'),
            data.get('loan_amount'),
            data.get('expected_month'),
            data.get('interest_rate'),
            data.get('est_gold_value'),
            data.get('emi'),
            data.get('per_gram_price'),
            data.get('app_date'),
            data.get('app_time')
        )

        cursor.execute(query, values)
        row_id=cursor.lastrowid
        conn.commit()
        
        cursor.execute("SELECT id,date FROM gold_loan_request WHERE id=%s",(row_id,));
        row=cursor.fetchone()
        row=inject_application_numbers(row,'Gold Loan')
        final_app_no=row[0]['app_no']
        
        
        email_status = ""
        try:
            msg = Message(
                subject=f"Gold Loan Application Submitted - {final_app_no}",
                sender=app.config['MAIL_USERNAME'],
                recipients=[session.get('email')] 
            )
            
            
            msg.html = render_template(
                'email/sendLoanSuccessEmail.html',
                user_name=session.get('user_name'),
                app_no=final_app_no,
                appointment_date= data.get('app_date'),
                appointment_time= data.get('app_time'),
                dashboard_url=url_for('index', _external=True),
                loan_name="Gold loan"
            )
            
            mail.send(msg)
            email_status = "Email Notification Sent."
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}")
            email_status = "Email Notification Failed."

        return jsonify({
            "success": True,
            "application_no": final_app_no,
            "message": f"Submitted Successfully! Ref No: {final_app_no}. {email_status}"
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Database Error: {e}")
        return jsonify({"status": "error", "message": "Internal server error"}), 500
        
    finally:
        if conn:
            conn.close()


# Bike Loan Request
@app.route('/request-bike-loan')
@login_required
def request_bike_loan():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """SELECT sp.interest_spread FROM spread_settings sp JOIN loan_type lt 
        ON sp.loan_id =lt.id WHERE name=%s"""
        cursor.execute(query, ("Bike Loan",))
        row=cursor.fetchone()
        interest_rate=float(row['interest_spread'])+float(extract_repo_rate()) +float(get_user_reliability_discount())
        
    except Exception as e:
       
        print(f"SQL Error: {str(e)}")
        interest_rate=0

    finally:
        if conn:
            conn.close()
            cursor.close()
    return render_template('userPanel/applyLoan/bikeLoanRequest.html',interest_rate=interest_rate) 


@app.route('/submit-bike-loan-request', methods=['POST'])
@login_required
@verify_documents
def submit_bike_loan_request():
    conn=None
    try:
        data = request.get_json()
        
        conn=get_db_connection()
        cursor=conn.cursor(dictionary=True)
           
        query = """
            INSERT INTO bike_loan_request (
                customer_id, bike_id, expected_month, interest_rate, 
                down_payment, final_amount, monthly_emi, 
                appointment_date, appointment_time
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        values = (
            session.get('user_id', 1), 
            data.get('bike_id'),
            data.get('expected_month'),
            data.get('interest_rate'),
            data.get('down_payment'),
            data.get('final_amount'),
            data.get('monthly_emi'),
            data.get('appointment_date'),
            data.get('appointment_time')  
        )

        cursor.execute(query, values)
        row_id=cursor.lastrowid
        conn.commit()
        
        cursor.execute("SELECT id,date FROM bike_loan_request WHERE id=%s",(row_id,));
        row=cursor.fetchone()
        row=inject_application_numbers(row,'Bike Loan')
        final_app_no=row[0]['app_no']
        
        
        email_status = ""
        try:
            msg = Message(
                subject=f"Bike Loan/Refinance Application Submitted - {final_app_no}",
                sender=app.config['MAIL_USERNAME'],
                recipients=[session.get('email')] 
            )
            
            
            msg.html = render_template(
                'email/sendLoanSuccessEmail.html',
                user_name=session.get('user_name'),
                app_no=final_app_no,
                appointment_date=data.get('appointment_date'),
                appointment_time=data.get('appointment_time')  ,
                dashboard_url=url_for('index', _external=True),
                loan_name="Bike Loan/Refinance"
            )
            
            mail.send(msg)
            email_status = "Email Notification Sent."
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}")
            email_status = "Email Notification Failed."

        return jsonify({
            "success": True,
            "application_no": final_app_no,
            "message": f"Submitted Successfully! Ref No: {final_app_no}. {email_status}"
        }), 200


    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    
    finally:
        if conn:
            conn.close()


@app.route('/request-bike-refinance')
@login_required
def request_bike_refinance():
     conn = None
     try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """SELECT sp.interest_spread FROM spread_settings sp JOIN loan_type lt 
        ON sp.loan_id =lt.id WHERE name=%s"""
        cursor.execute(query, ("Bike Loan",))
        row=cursor.fetchone()
        interest_rate=float(row['interest_spread'])+float(extract_repo_rate()) +float(get_user_reliability_discount())
        
     except Exception as e:
       
        print(f"SQL Error: {str(e)}")
        interest_rate=0

     finally:
        if conn:
            conn.close()
            cursor.close()
     return render_template('userPanel/applyLoan/bikeRefinanceRequest.html',interest_rate=interest_rate)




# Loan Status | Gold Loan Status
@app.route('/gold-loan-status')
@login_required
def gold_loan_status():
    return render_template('userPanel/loanStatus/goldLoanStatus.html')



@app.route('/get-customer-gold-loans', methods=['POST'])
@login_required
def get_customer_gold_loans():
    conn = None 
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"success": False, "message": "Unauthorized"}), 401

        data = request.get_json() or {}
        search_query = str(data.get('q', '')).strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        sql = """
            SELECT gl.id, gl.customer_id, u.full_name AS name, u.mobile_number AS phone, 
                   u.email, gl.monthly_emi AS loan_emi, gl.gold_weight, gl.processing_fee, gl.loan_amount, 
                   gl.expected_month, gl.status, gl.description, gl.date, 
                   glt.item_name AS gold_type, glp.purity AS gold_purity, gl.gram_per_price AS gram_price, 
                   gl.appointment_date, gl.appointment_time, gl.customer_status, 
                   gl.estimated_amount, gl.credit_score, gl.interest_rate
            FROM gold_loan_request gl
            LEFT JOIN users u ON gl.customer_id = u.id
            LEFT JOIN gold_type glt ON gl.gold_loan_type_id = glt.id
            LEFT JOIN gold_purity glp ON gl.gold_loan_purity_id = glp.id
            WHERE gl.customer_id = %s
        """
        
        params = [user_id]
        where_clause = ""

        if search_query:
            if 'GL-' in search_query:
                if bool(re.match(r"^GL-\d{6}-\d{6}-\d+$", search_query)):
                    where_clause = " AND gl.date = %s AND gl.id = %s"
                    params.extend([get_transaction_time(search_query), search_query.split('-')[-1]])
                else:
                    return jsonify([]) 
            else:
                where_clause = " AND (gl.status LIKE %s OR glt.item_name LIKE %s)"
                params.extend([f"%{search_query}%", f"%{search_query}%"])

        final_sql = sql + where_clause + " ORDER BY gl.date DESC"
        
        cursor.execute(final_sql, params)
        rows = cursor.fetchall()

        for row in rows:
            for key, value in row.items():
                if isinstance(value, (timedelta, date)):
                    row[key] = str(value)
                if value is None:
                    row[key] = ""
            
            if 'loan_amount' in row and row['loan_amount'] != "":
                row['loan_amount'] = float(row['loan_amount'])
            if 'loan_emi' in row and row['loan_emi'] != "":
                row['loan_emi'] = float(row['loan_emi'])

        rows = inject_application_numbers(rows, 'Gold Loan')
        
        for row in rows:
            if 'date' in row and row['date']:
                try:
                    dt_obj = datetime.strptime(row['date'], '%Y-%m-%d')
                    row['apply_date'] = dt_obj.strftime('%d %b, %Y')
                except:
                    row['apply_date'] = row['date']
            
            if 'appointment_date' in row and row['appointment_date']:
                try:
                    appt_obj = datetime.strptime(row['appointment_date'], '%Y-%m-%d')
                    row['appointment_date'] = appt_obj.strftime('%d %b, %Y')
                except:
                    pass

        return jsonify(rows)
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/cancel-gold-loan-request/<int:loan_id>', methods=['POST'])
@login_required
def cancel_gold_loan_request(loan_id):
    conn = None
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"success": False, "message": "Unauthorized"}), 401

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Check if the loan belongs to the user and is still pending
        cursor.execute("""
            SELECT status FROM gold_loan_request 
            WHERE id = %s AND customer_id = %s
        """, (loan_id, user_id))
        
        loan = cursor.fetchone()

        if not loan:
            return jsonify({"success": False, "message": "Loan request not found"}), 404
        
        if loan['status'] != 'pending':
            return jsonify({
                "success": False, 
                "message": f"Cannot withdraw a loan that is already {loan['status']}."
            }), 400

        
        cursor.execute("""
            UPDATE gold_loan_request 
            SET status = 'withdrawn', description = 'Withdrawn by customer',
            withdrawn_date=%s
            WHERE id = %s
        """, (loan_id,datetime.now().strftime('%d %b, %Y')))
        
        conn.commit()
        
      
        cursor.execute("""
            SELECT id, date, loan_amount 
            FROM gold_loan_request 
            WHERE id = %s
        """, (loan_id,))
        row = cursor.fetchone()
        
        
        row_with_app = inject_application_numbers([row], 'Gold Loan')
        final_app_no = row_with_app[0]['app_no']
        loan_amount = row_with_app[0]['loan_amount']
        
        email_status = ""
        try:
            msg = Message(
                subject=f"Gold Loan Application Withdrawn - {final_app_no}",
                sender=app.config['MAIL_USERNAME'],
                recipients=[session.get('email')] 
            )
            
    
            msg.html = render_template(
                'email/sendLoanWithdrawEmail.html',
                user_name=session.get('user_name'),
                app_no=final_app_no,
                loan_amount=f"{float(loan_amount):,.2f}",
                withdrawal_date=datetime.now().strftime('%d %b, %Y'),
                dashboard_url=url_for('index', _external=True),
                loan_name="Gold Loan"
            )
            
            mail.send(msg)
            email_status = "Withdrawal Email Sent."
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}")
            email_status = "Withdrawal Email Failed."
            
        return jsonify({
            "success": True, 
            "message": "Application Withdrawn Successfully",
            "email_status": email_status
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()
            
@app.route('/reschedule-gold-loan/<int:loan_id>', methods=['POST'])
@login_required
def reschedule_gold_loan(loan_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    data = request.get_json()
    new_date = data.get('date')
    new_time = data.get('time')
    
    user_name = session.get('user_name')
    user_email = session.get('email')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # 1. Fetch Current Gold Loan Data
        cursor.execute("""
            SELECT id, status, appointment_date, appointment_time, date 
            FROM gold_loan_request 
            WHERE id = %s AND customer_id = %s
        """, (loan_id, session['user_id']))
        loan = cursor.fetchone()

        if not loan or loan['status'] != 'pending':
            return jsonify({"success": False, "message": "Loan not found or already processed"}), 400

        # 2. Capture Old Slot for Email
        old_date_str = loan['appointment_date'].strftime('%d %b, %Y') if loan['appointment_date'] else "Not Scheduled"
        old_time_str = str(loan['appointment_time']) if loan['appointment_time'] else "--:--"

        # 3. Generate App ID using Helper (Gold Loan context)
        temp_list = inject_application_numbers([loan], 'Gold Loan')
        final_app_no = temp_list[0]['app_no']

        # 4. Update Database
        cursor.execute("""
            UPDATE gold_loan_request 
            SET appointment_date = %s, appointment_time = %s 
            WHERE id = %s
        """, (new_date, new_time, loan_id))
        conn.commit()

        # 5. Send Reschedule Email
        try: 
            msg = Message(
                subject=f"Gold Appraisal Rescheduled - {final_app_no}",
                sender=app.config['MAIL_USERNAME'],
                recipients=[user_email]
            )
            
            new_date_formatted = datetime.strptime(new_date, '%Y-%m-%d').strftime('%d %b, %Y')

            msg.html = render_template('email/sendLoanRescheduleEmail.html',
                user_name=user_name,
                app_no=final_app_no,
                loan_name="Gold Loan",
                old_date=old_date_str,
                old_time=old_time_str,
                new_date=new_date_formatted,
                new_time=new_time,
                dashboard_url=url_for('gold_loan_status', _external=True)
            )
            mail.send(msg)
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}")

        return jsonify({"success": True, "message": "Rescheduled successfully"})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()





# Bike Loan Status
@app.route('/bike-loan-status')
@login_required
def bike_loan_status():
    return render_template('userPanel/loanStatus/bikeLoanStatus.html')



@app.route('/get-customer-bike-loans', methods=['POST'])
@login_required
def get_customer_bike_loans():
    conn = None 
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"success": False, "message": "Unauthorized"}), 401

        data = request.get_json() or {}
        search_query = str(data.get('q', '')).strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
       
        sql = """
            SELECT 
                bl.id, bl.customer_id, bl.bike_id, 
                bl.expected_month, bl.interest_rate, bl.status, 
                bl.description, bl.date, bl.processing_fee, 
                bl.down_payment, bl.final_amount, bl.monthly_emi, 
                bl.appointment_date, bl.appointment_time, 
                bl.customer_status, bl.credit_score,
                b.bike_name, b.bike_type AS bike_condition,b.on_road_price As bike_price
            FROM bike_loan_request bl
            LEFT JOIN bike_master b ON bl.bike_id = b.id
            WHERE bl.customer_id = %s
        """
        
        params = [user_id]
        where_clause = ""

      
        if search_query:
            if 'BL-' in search_query:
                if bool(re.match(r"^BL-\d{6}-\d{6}-\d+$", search_query)):
                    where_clause = " AND bl.date = %s AND bl.id = %s"
                    params.extend([get_transaction_time(search_query), search_query.split('-')[-1]])
                else:
                    return jsonify([]) 
            else:
                where_clause = " AND (bl.status LIKE %s OR b.bike_name LIKE %s)"
                params.extend([f"%{search_query}%", f"%{search_query}%"])

        final_sql = sql + where_clause + " ORDER BY bl.date DESC"
        
        cursor.execute(final_sql, params)
        rows = cursor.fetchall()

        # Data Cleansing & Type Conversion
        for row in rows:
            for key, value in row.items():
                # Convert Decimal (final_amount/emi) to float for JSON compatibility
                if isinstance(value, Decimal):
                    row[key] = float(value)
                # Convert date/time objects to strings
                elif isinstance(value, (timedelta, date)):
                    row[key] = str(value)
                # Handle nulls
                if value is None:
                    row[key] = ""
            
            # Map standard aliases for the frontend (matches Gold Loan structure)
            row['loan_amount'] = row.get('final_amount', 0)
            row['loan_emi'] = row.get('monthly_emi', 0)

    
        rows = inject_application_numbers(rows, 'Bike Loan')
        
        # Date Formatting for UI
        for row in rows:
            if 'date' in row and row['date']:
                try:
                    dt_obj = datetime.strptime(str(row['date']).split(' ')[0], '%Y-%m-%d')
                    row['apply_date'] = dt_obj.strftime('%d %b, %Y')
                except:
                    row['apply_date'] = row['date']
            
            if 'appointment_date' in row and row['appointment_date']:
                try:
                    appt_obj = datetime.strptime(str(row['appointment_date']), '%Y-%m-%d')
                    row['appointment_date'] = appt_obj.strftime('%d %b, %Y')
                except:
                    pass

        return jsonify(rows)
        
    except Exception as e:
        print(f"Database Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()
            


@app.route('/cancel-bike-loan-request/<int:loan_id>', methods=['POST'])
@login_required
def cancel_bike_loan_request(loan_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    user_id = session.get('user_id')
    user_email = session.get('email')
    user_name = session.get('user_name')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 1. Ownership & Status Check
        cursor.execute("SELECT status, date FROM bike_loan_request WHERE id = %s AND customer_id = %s", (loan_id, user_id))
        loan = cursor.fetchone()
        
        if not loan:
            return jsonify({"success": False, "message": "Request not found"}), 404
        
        if loan['status'] != 'pending':
            return jsonify({"success": False, "message": f"Cannot withdraw an {loan['status']} application"}), 400

        # 2. Update Status
        cursor.execute("UPDATE bike_loan_request SET status = 'withdrawn' WHERE id = %s", (loan_id,))
        conn.commit()

        # 3. Trigger Confirmation Email
        # Prepare data for template
        temp_list = inject_application_numbers([{'id': loan_id, 'date': loan['date']}], "BL")
        final_app_no = temp_list[0]['app_no']

        try:
            msg = Message(
                subject=f"Bike Loan Application Withdrawn - {final_app_no}",
                sender=app.config['MAIL_USERNAME'],
                recipients=[user_email]
            )
            msg.html = render_template(
                'email/sendLoanWithdrawEmail.html',
                user_name=user_name,
                app_no=final_app_no,
                loan_name="Bike Loan",
                dashboard_url=url_for('bike_loan_status', _external=True) 
            )
            mail.send(msg)
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}") 

        return jsonify({"success": True, "message": "Application Withdrawn Successfully"})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
        


@app.route('/reschedule-bike-loan/<int:loan_id>', methods=['POST'])
@login_required
def reschedule_bike_loan(loan_id):

    data = request.get_json()
    new_date = data.get('date')
    new_time = data.get('time')
    
    user_name = session.get('user_name')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # 1. FETCH CURRENT DATA (Status, Old Slot, and Date for ID generation)
        cursor.execute("""
            SELECT id, status, appointment_date, appointment_time, date 
            FROM bike_loan_request 
            WHERE id = %s AND customer_id = %s
        """, (loan_id, session['user_id']))
        loan = cursor.fetchone()

        if not loan or loan['status'] != 'pending':
            return jsonify({"success": False, "message": "Cannot reschedule processed loans"}), 400

        # 2. CAPTURE OLD SLOT STRINGS
        old_date_str = loan['appointment_date'].strftime('%d %b, %Y') if loan['appointment_date'] else "Not Scheduled"
        old_time_str = str(loan['appointment_time']) if loan['appointment_time'] else "--:--"

        # 3. GENERATE APP ID USING HELPER FUNCTION
        # Wrap single loan in a list as expected by inject_application_numbers
        result = inject_application_numbers([loan], 'Bike Loan')
        final_app_no = result[0]['app_no']

        # 4. UPDATE DATABASE
        cursor.execute("""
            UPDATE bike_loan_request 
            SET appointment_date = %s, appointment_time = %s 
            WHERE id = %s
        """, (new_date, new_time, loan_id))
        conn.commit()

        # 5. SEND CONFIRMATION EMAIL
        try: 
            msg = Message(
                subject=f"Appointment Rescheduled - {final_app_no}",
                sender=app.config['MAIL_USERNAME'],
                recipients=[session.get('email')]
            )
            
            new_date_formatted = datetime.strptime(new_date, '%Y-%m-%d').strftime('%d %b, %Y')

            msg.html = render_template('email/sendLoanRescheduleEmail.html',
                user_name=user_name,
                app_no=final_app_no,
                loan_name="Bike Loan",
                old_date=old_date_str,
                old_time=old_time_str,
                new_date=new_date_formatted,
                new_time=new_time,
                dashboard_url=url_for('bike_loan_status', _external=True)
            )
            mail.send(msg)
        except Exception as mail_err:
            print(f"Mail Error: {mail_err}")

        return jsonify({"success": True, "message": "Rescheduled successfully"})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()



@app.route('/gold-loan-list')
@login_required
def gold_loan_list():
    return render_template('userPanel/repayments/goldLoanList.html')


@app.route('/get-customer-gold-records', methods=['POST'])
@login_required
def get_customer_gold_records():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = None
    try:
        data = request.get_json() or {}
        search_query = data.get('search', '').strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        base_sql = """
            SELECT 
                gl.id, 
                gl.customer_id, 
                u.full_name AS name, 
                u.mobile_number AS phone, 
                u.email, 
                lt.name AS gold_type, 
                gl.gold_weight, 
                gl.processing_fee, 
                gl.loan_amount, 
                gl.expected_month, 
                gl.status, 
                gl.description, 
                gl.date, 
                gl.monthly_emi, 
                gl.appointment_date AS appt_date, 
                gl.appointment_time AS appt_time, 
                gl.customer_status, 
                gl.estimated_amount AS est_amount,
                gl.interest_rate
            FROM gold_loan_request gl
            LEFT JOIN users u ON gl.customer_id = u.id
            LEFT JOIN loan_type lt ON gl.gold_loan_id = lt.id
            WHERE gl.customer_id = %s AND gl.status = %s
        """

        params = [user_id, 'approved']

        if search_query:
            if 'GL-' in search_query:
                if bool(re.match(r"^GL-\d{6}-\d{6}-\d+$", search_query)):
                    base_sql += " AND gl.date = %s AND gl.id = %s"
                    params.append(get_transaction_time(search_query))
                    params.append(search_query.split('-')[-1])
                else:
                    return jsonify([]) 
            else:
                base_sql += " AND (gl.id LIKE %s OR lt.name LIKE %s)"
                params.append(f"%{search_query}%")
                params.append(f"%{search_query}%")

        base_sql += " ORDER BY gl.date DESC"
        
        cursor.execute(base_sql, tuple(params))
        rows = cursor.fetchall()
      
        for row in rows:
            for key, value in row.items():
                if isinstance(value, (timedelta, date)):
                    row[key] = str(value)
                elif value is None:
                    row[key] = ""
                
                if key in ['loan_amount', 'monthly_emi', 'est_amount'] and value is not None:
                    row[key] = float(value)
        
        rows = inject_application_numbers(rows, "gold loan")   
        
        return jsonify(rows)
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify([])
    finally:
        if conn:
            cursor.close()
            conn.close()
            


@app.route('/<loan_type>/emil-payment/<int:loan_request_id>')
@login_required
def loan_type_emil_payment(loan_type, loan_request_id):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if loan_type == 'bike':
            query = """
                SELECT bl.id,
                    bl.final_amount, bl.monthly_emi, bl.expected_month, 
                    bl.appointment_date, bm.company_name, bm.bike_model, bm.bike_name, bl.date,bl.interest_rate
                FROM bike_loan_request bl
                JOIN bike_master bm ON bl.bike_id = bm.id
                WHERE bl.id = %s
            """
            cursor.execute(query, (loan_request_id,))
            bike_loan = cursor.fetchone()
           
            bike_loan=inject_application_numbers(bike_loan,'bike loan')[0]
           
           
            if not bike_loan: return "Bike Loan record not found", 404
            
            return render_template('userPanel/repayments/bikeLoanEMIPayment.html', bike_loan=bike_loan)

        elif loan_type == 'gold':
            
            query = """
                SELECT 
                    gl.id,
                    gt.item_name,
                    gl.gold_weight,
                    gl.loan_amount,
                    gl.expected_month,
                    gl.monthly_emi,
                    gl.appointment_date,
                    gl.date,
                    gl.interest_rate
                FROM gold_loan_request gl
                JOIN gold_type gt ON gl.gold_loan_type_id = gt.id
                WHERE gl.id = %s
            """
            cursor.execute(query, (loan_request_id,))
            gold_loan = cursor.fetchone()
            gold_loan=inject_application_numbers(gold_loan,'gold loan')[0]
            if not gold_loan:
                return "Gold Loan record not found", 404
                
            return render_template('userPanel/repayments/goldLoanEMIPayment.html', gold_loan=gold_loan)

    except Exception as e:
        print(f"Error: {e}")
        return "Internal Server Error", 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/bike-loan-list')
@login_required
def gold_loans_emi():
    return render_template('userPanel/repayments/bikeLoanList.html')


@app.route('/get-customer-bike-records', methods=['POST'])
@login_required
def get_customer_bike_records():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify([])

    conn = None
    try:
        data = request.get_json() or {}
        search_query = data.get('search', '').strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id FROM loan_type WHERE name = 'Bike Loan' LIMIT 1")
        category = cursor.fetchone()
        
        if not category:
            return jsonify([])
        
        bike_loan_type_id = category['id']

        base_sql = """
            SELECT 
                bl.*, 
                u.full_name AS name, 
                u.mobile_number AS phone, 
                u.email,
                bm.bike_name, 
                bm.company_name, 
                bm.bike_type,
                bm.enginecc, 
                bm.fuel_type, 
                
                bm.on_road_price AS onroad_price,
                bl.credit_score,
                bl.date
            FROM bike_loan_request bl
            LEFT JOIN users u ON bl.customer_id = u.id
            LEFT JOIN bike_master bm ON bl.bike_id = bm.id
            WHERE bl.customer_id = %s AND bl.status = %s AND bm.loan_id = %s
        """

        params = [user_id, 'approved', bike_loan_type_id]

        if search_query:
            if 'BL-' in search_query:
                if bool(re.match(r"^BL-\d{6}-\d{6}-\d+$", search_query)):
                    base_sql += " AND bl.date = %s AND bl.id = %s"
                    params.append(get_transaction_time(search_query))
                    params.append(search_query.split('-')[-1])
                else:
                    return jsonify([])
            else:
                base_sql += " AND (bm.bike_name LIKE %s OR bm.company_name LIKE %s)"
                params.append(f"%{search_query}%")
                params.append(f"%{search_query}%")

        base_sql += " ORDER BY bl.date DESC"
        
        cursor.execute(base_sql, tuple(params))
        rows = cursor.fetchall()
        
        for row in rows:
            for key, value in row.items():
                if isinstance(value, (timedelta, date)):
                    row[key] = str(value)
                elif value is None:
                    row[key] = ""
                
                if key in ['final_amount', 'monthly_emi', 'onroad_price', 'showroom_price']:
                    try:
                        row[key] = float(value) if value != "" else 0.0
                    except (ValueError, TypeError):
                        row[key] = 0.0
                        
        rows = inject_application_numbers(rows, 'bike loan')
        return jsonify(rows)

    except Exception as e:
        print(f"Error: {e}")
        return jsonify([])
    finally:
        if conn:
            cursor.close()
            conn.close()


# Digital Wallet | Add money


@app.route('/wallet-topup')
@login_required
def wallet_topup():
    user_id = session.get('user_id')
    conn = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Fetch current wallet balance
        cursor.execute("SELECT balance FROM digital_wallet WHERE customer_id = %s", (user_id,))
        result = cursor.fetchone()
        wallet_balance = float(result['balance']) if result and result['balance'] is not None else 0.00
        
        # Calculate Total Monthly EMI from both loan types
       
        emi_query = """
        SELECT 
            (SELECT IFNULL(SUM(monthly_emi), 0) FROM bike_loan_request WHERE customer_id = %s AND status = 'approved' AND customer_status='active') +
            (SELECT IFNULL(SUM(monthly_emi), 0) FROM gold_loan_request WHERE customer_id = %s AND status = 'approved' AND customer_status='active') 
            as total_monthly_emi;
        """
        cursor.execute(emi_query, (user_id, user_id))
        emi_result = cursor.fetchone()
        total_monthly_emi = float(emi_result['total_monthly_emi']) if emi_result else 0.00
        
        # Calculate Smart Max Limit (3 months of EMI)
        # If no active loans, we can set a default small limit like 5000 or keep it 0
        max_wallet_limit = total_monthly_emi * 3
        if max_wallet_limit == 0:
            max_wallet_limit = 5000.00 # Default fallback for users with no active loans
            
       
        remaining_limit = max(0, max_wallet_limit - wallet_balance)

        return render_template('userPanel/digitalWallet/walletTopup.html', 
                               wallet_balance=wallet_balance, 
                               max_limit=max_wallet_limit,
                               remaining_limit=remaining_limit)
        
    except Exception as e:
        print(f"Error: {e}")
        return "Internal Server Error", 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/wallet-transactions')
@login_required
def wallet_transactions():
    return render_template('userPanel/digitalWallet/walletTransactions.html')


# Wallet history
@app.route('/get-wallet-history')
@login_required
def get_wallet_history():
    user_id = session.get('user_id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT vt.*, 
                   DATE_FORMAT(vt.created_at, '%d %b %Y') as display_date,
                   DATE_FORMAT(vt.payment_time, '%h:%i %p') as display_time
            FROM wallet_transaction vt
            JOIN digital_wallet dw ON vt.wallet_id = dw.id
            WHERE dw.customer_id = %s
            ORDER BY vt.id DESC
        """
        cursor.execute(query, (user_id,))
        transactions = cursor.fetchall()

        # --- FIX STARTS HERE ---
        import datetime
        for row in transactions:
            for key, value in row.items():
                # If the value is a timedelta (MySQL TIME), convert to string
                if isinstance(value, datetime.timedelta):
                    # This converts the object to 'HH:MM:SS' string
                    row[key] = str(value) 
        # --- FIX ENDS HERE ---
        
        return jsonify({
            "success": True,
            "data": transactions
        }), 200
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

 

@app.route('/generate-receipt-view/wallet', methods=['POST'])
@login_required
def generate_wallet_receipt():
    conn = None
    try:
        data = request.get_json()
        tx_id = data.get('transaction_id')

        if not tx_id:
            return jsonify({"success": False, "message": "Transaction ID missing"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Optimized query for receipt data
        query = """
            SELECT vt.*, 
                   DATE_FORMAT(vt.created_at, '%d %b %Y') as display_date,
                   DATE_FORMAT(vt.payment_time, '%h:%i %p') as display_time,
                   u.full_name, u.mobile_number as phone,u.email
            FROM wallet_transaction vt
            JOIN digital_wallet dw ON vt.wallet_id = dw.id
            JOIN users u ON dw.customer_id = u.id
            WHERE vt.id = %s
        """
        cursor.execute(query, (tx_id,))
        tx_data = cursor.fetchone()
        tx_data['system_ip_address'] = get_system_ip_address()

        if not tx_data:
            return jsonify({"success": False, "message": "Transaction not found"}), 404

        
        return render_template('pdf/wallet_receipt_print.html', tx=tx_data)

    except Exception as e:
        print(f"Receipt Error: {e}")
        return jsonify({"success": False, "message": "Internal Server Error"}), 500
    finally:
        if conn:
            conn.close() 


@app.route('/v/<payment_id>/<sig_fragment>')
def verify_wallet_transaction(payment_id, sig_fragment):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Verify transaction against the public payment_id
        query = """
            SELECT vt.*, 
                   DATE_FORMAT(vt.created_at, '%d %b %Y') as display_date,
                   DATE_FORMAT(vt.payment_time, '%h:%i %p') as display_time,
                   u.full_name, u.email, u.mobile_number AS phone
            FROM wallet_transaction vt
            JOIN digital_wallet dw ON vt.wallet_id = dw.id
            JOIN users u ON dw.customer_id = u.id
            WHERE vt.payment_id = %s
        """
        cursor.execute(query, (payment_id,))
        txn = cursor.fetchone()

        # Security check: Does the record exist AND does the signature start with the fragment?
        if txn and txn['digital_signature'][:16] == sig_fragment:
            return render_template('pdf/wallet_add_amount_verify_success.html', tx=txn)
        else:
            # If someone tampered with the URL, show failure
            return render_template('pdf/wallet_add_amount_verify_fail.html'), 404

    except Exception as e:
        print(f"Verification Logic Error: {e}")
        return "System Verification Offline", 500
    finally:
        if conn:
            conn.close() 

 

@app.route('/get-wallet-balance', methods=['GET'])
@login_required
def get_wallet_balance():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Fetch balance for the logged-in user
        # Assuming digital_wallet.customer_id maps to users.id
        query = """
            SELECT balance 
            FROM digital_wallet 
            WHERE customer_id = %s
        """
        cursor.execute(query, (session['user_id'],))
        wallet = cursor.fetchone()

        if wallet:
            return jsonify({
                "success": True,
                "balance": float(wallet['balance'])
            })
        else:
            # If no wallet exists for the user, return 0
            return jsonify({
                "success": True,
                "balance": 0.00
            })

    except Exception as e:
        print(f"Wallet Balance Error: {e}")
        return jsonify({"success": False, "message": "Could not fetch balance"}), 500
    finally:
        if conn:
            conn.close() 

               
if __name__=='__main__':
    ip = get_system_ip_address()
    print(f"Server running on:")
    print(f"Running on http://localhost:5000")
    print(f"Running on http://{ip}:5000")
    logging.getLogger('werkzeug').setLevel(logging.CRITICAL)
    app.run(host="0.0.0.0",debug=True)

