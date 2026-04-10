-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 02, 2026 at 07:52 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `finance_management`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `id` int(11) NOT NULL,
  `email` varchar(50) NOT NULL,
  `password` varchar(100) NOT NULL,
  `profile_image` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin`
--

INSERT INTO `admin` (`id`, `email`, `password`, `profile_image`) VALUES
(1, 'admin@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$HlY5+hgu5E89ktYPNXo/xQ$DwglGpUmeEHRZ/03h8NcMU1Kt4Wl5sDp/o4l19HeEe0', 'admin_profile_images.png');

-- --------------------------------------------------------

--
-- Table structure for table `admin_passkeys`
--

CREATE TABLE `admin_passkeys` (
  `id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `credential_id` varbinary(1024) NOT NULL,
  `public_key` varbinary(1024) NOT NULL,
  `sign_count` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_passkeys`
--

INSERT INTO `admin_passkeys` (`id`, `admin_id`, `credential_id`, `public_key`, `sign_count`) VALUES
(11, 1, 0x9e78144a33ae9fea089f5bb6caace3736f9be5a1e992a6926849d074df7250c4, 0xa501020326200121582093e869a6a21b30428f0a3cef3f7ffcb1b279e24b7fee5181c1904ac9309930142258207d95b58947984deabf25727c254fb4b617b48c8f0308ee508ed67a7f9324b2b8, 1);

-- --------------------------------------------------------

--
-- Table structure for table `bike_loan_emi`
--

CREATE TABLE `bike_loan_emi` (
  `id` int(11) NOT NULL,
  `bike_loan_request_id` int(11) NOT NULL,
  `due_date` date NOT NULL,
  `emi_date` date DEFAULT NULL,
  `emi_time` time NOT NULL DEFAULT current_timestamp(),
  `emi_amount` int(11) NOT NULL,
  `installment_no` int(11) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `late_fee` int(11) DEFAULT 0,
  `razorpay_transaction_id` int(11) DEFAULT NULL,
  `wallet_transaction_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bike_loan_emi`
--

INSERT INTO `bike_loan_emi` (`id`, `bike_loan_request_id`, `due_date`, `emi_date`, `emi_time`, `emi_amount`, `installment_no`, `status`, `late_fee`, `razorpay_transaction_id`, `wallet_transaction_id`) VALUES
(49, 35, '2026-05-04', '2026-04-01', '11:31:56', 16372, 1, 'paid', 0, 32, 74),
(50, 35, '2026-06-04', '2026-04-01', '11:33:58', 16372, 2, 'paid', 0, 33, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `bike_loan_request`
--

CREATE TABLE `bike_loan_request` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `bike_id` int(11) NOT NULL,
  `expected_month` int(3) DEFAULT NULL,
  `interest_rate` int(11) NOT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `description` text DEFAULT NULL,
  `date` timestamp NOT NULL DEFAULT current_timestamp(),
  `processing_fee` int(11) NOT NULL DEFAULT 1180,
  `down_payment` int(11) NOT NULL DEFAULT 0,
  `final_amount` decimal(15,2) NOT NULL,
  `monthly_emi` decimal(15,2) DEFAULT NULL,
  `appointment_date` date DEFAULT NULL,
  `appointment_time` time DEFAULT NULL,
  `customer_status` varchar(50) DEFAULT 'inactive',
  `credit_score` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bike_loan_request`
--

INSERT INTO `bike_loan_request` (`id`, `customer_id`, `bike_id`, `expected_month`, `interest_rate`, `status`, `description`, `date`, `processing_fee`, `down_payment`, `final_amount`, `monthly_emi`, `appointment_date`, `appointment_time`, `customer_status`, `credit_score`) VALUES
(35, 26, 7, 12, 11, 'approved', 'Excellent news! Your Bike Loan has been sanctioned. You are one step closer to riding your new bike.', '2026-04-01 05:56:16', 1180, 30000, 185000.00, 16372.00, '2026-04-04', '11:00:00', 'active', 758);

-- --------------------------------------------------------

--
-- Table structure for table `bike_master`
--

CREATE TABLE `bike_master` (
  `id` int(11) NOT NULL,
  `loan_id` int(11) NOT NULL,
  `bike_type` varchar(15) NOT NULL,
  `bike_name` varchar(30) NOT NULL,
  `company_name` varchar(40) NOT NULL,
  `bike_model` year(4) NOT NULL,
  `enginecc` int(11) NOT NULL,
  `showroom_price` int(11) NOT NULL,
  `on_road_price` int(11) NOT NULL,
  `fuel_type` varchar(25) NOT NULL,
  `gst_rate` tinyint(4) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bike_master`
--

INSERT INTO `bike_master` (`id`, `loan_id`, `bike_type`, `bike_name`, `company_name`, `bike_model`, `enginecc`, `showroom_price`, `on_road_price`, `fuel_type`, `gst_rate`, `created_at`) VALUES
(7, 1, 'New Bike', 'R15 V4', 'Yamaha', '2024', 155, 182001, 215000, 'Petrol', 28, '2026-03-14 17:30:56'),
(8, 1, 'New Bike', 'Splendor Plus', 'Hero', '2023', 97, 75000, 92000, 'Petrol', 18, '2026-03-14 17:30:56'),
(9, 1, 'Old Bike', 'Activa 6G', 'Honda', '2024', 109, 78000, 95000, 'Petrol', 28, '2026-03-14 17:30:56'),
(10, 1, 'Old Bike', 'Pulsar N250', 'Bajaj', '2024', 249, 151001, 178000, 'CNG', 18, '2026-03-14 17:30:56');

-- --------------------------------------------------------

--
-- Table structure for table `contact_inquiries`
--

CREATE TABLE `contact_inquiries` (
  `id` int(11) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `message_body` text NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `inquiry_status` enum('unread','read','replied') DEFAULT 'unread',
  `replied_message` text DEFAULT NULL,
  `replied_by` int(11) DEFAULT NULL,
  `replied_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `contact_inquiries`
--

INSERT INTO `contact_inquiries` (`id`, `full_name`, `email`, `message_body`, `submitted_at`, `inquiry_status`, `replied_message`, `replied_by`, `replied_at`) VALUES
(3, 'Rajesh Kumar', 'rajesh.k@example.com', 'I am interested in a personal loan of ₹50,000 for my daughter\'s education. What documents are needed?', '2026-03-09 04:45:00', 'unread', NULL, NULL, NULL),
(4, 'Sneha Patel', 'sneha.patel92@example.com', 'I have some gold ornaments for valuation. Can I visit your Surat branch tomorrow morning?', '2026-03-09 06:00:45', 'unread', NULL, NULL, NULL),
(5, 'Amit Sharma', 'amit.sharma@email.com', 'My EMI payment failed today even though I have balance. Please check my account status.', '2026-03-09 07:35:20', 'read', NULL, NULL, NULL),
(6, 'Priya Mehta', 'priya.finance@example.com', 'How long does the manual verification process take for a loan of ₹25,000?', '2026-03-09 09:15:10', 'read', NULL, NULL, NULL),
(7, 'Vikram Singh', 'udayp@example.com', 'I want to close my current loan early. Are there any foreclosure charges?', '2026-03-09 10:50:00', 'replied', 'zdfad', 0, '2026-03-10 18:26:56'),
(8, 'Anjali Desai', 'anjali.desai@email.com', 'Is it possible to increase my current credit limit? I have been a customer for 6 months.', '2026-03-09 12:40:30', 'read', 'sdf', 0, '2026-03-09 16:53:57'),
(9, 'Suresh Gupta', 'suresh.g@example.com', 'Excellent service by the staff at the Varachha branch. Thank you for the quick processing!', '2026-03-09 14:25:15', 'replied', 'Read completed', 0, '2026-03-09 16:38:58');

-- --------------------------------------------------------

--
-- Table structure for table `digital_wallet`
--

CREATE TABLE `digital_wallet` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `balance` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `digital_wallet`
--

INSERT INTO `digital_wallet` (`id`, `customer_id`, `balance`) VALUES
(4, 26, 0);

-- --------------------------------------------------------

--
-- Table structure for table `gold_loan_emi`
--

CREATE TABLE `gold_loan_emi` (
  `id` int(11) NOT NULL,
  `gold_loan_request_id` int(11) NOT NULL,
  `due_date` date NOT NULL,
  `emi_date` date DEFAULT current_timestamp(),
  `emi_time` time NOT NULL DEFAULT current_timestamp(),
  `emi_amount` int(11) NOT NULL,
  `installment_no` int(11) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `late_fee` int(11) NOT NULL DEFAULT 0,
  `razorpay_transaction_id` int(11) DEFAULT NULL,
  `wallet_transaction_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `gold_loan_emi`
--

INSERT INTO `gold_loan_emi` (`id`, `gold_loan_request_id`, `due_date`, `emi_date`, `emi_time`, `emi_amount`, `installment_no`, `status`, `late_fee`, `razorpay_transaction_id`, `wallet_transaction_id`) VALUES
(91, 59, '2026-05-02', '2026-04-01', '11:29:05', 8111, 1, 'paid', 0, 31, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `gold_loan_request`
--

CREATE TABLE `gold_loan_request` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `gold_loan_id` int(11) NOT NULL,
  `gold_loan_type_id` int(11) NOT NULL,
  `gold_loan_purity_id` int(11) NOT NULL,
  `gold_weight` decimal(10,3) NOT NULL,
  `processing_fee` decimal(10,2) DEFAULT 1180.00,
  `loan_amount` decimal(15,2) NOT NULL,
  `expected_month` int(3) DEFAULT NULL,
  `interest_rate` int(11) NOT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `description` text DEFAULT NULL,
  `date` timestamp NOT NULL DEFAULT current_timestamp(),
  `withdrawn_date` date DEFAULT NULL,
  `estimated_amount` decimal(15,2) DEFAULT NULL,
  `monthly_emi` decimal(15,2) DEFAULT NULL,
  `gram_per_price` decimal(10,2) DEFAULT NULL,
  `appointment_date` date DEFAULT NULL,
  `appointment_time` time DEFAULT NULL,
  `customer_status` varchar(50) DEFAULT 'inactive',
  `credit_score` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `gold_loan_request`
--

INSERT INTO `gold_loan_request` (`id`, `customer_id`, `gold_loan_id`, `gold_loan_type_id`, `gold_loan_purity_id`, `gold_weight`, `processing_fee`, `loan_amount`, `expected_month`, `interest_rate`, `status`, `description`, `date`, `withdrawn_date`, `estimated_amount`, `monthly_emi`, `gram_per_price`, `appointment_date`, `appointment_time`, `customer_status`, `credit_score`) VALUES
(59, 26, 2, 1, 12, 10.000, 1180.00, 92875.00, 12, 9, 'approved', 'Congratulations! Your Gold Loan application has been approved. Our team has successfully reviewed your request and confirmed your eligibility.', '2026-04-01 05:54:59', NULL, 132678.00, 8111.00, 14474.00, '2026-04-02', '12:00:00', 'active', 760);

-- --------------------------------------------------------

--
-- Table structure for table `gold_price`
--

CREATE TABLE `gold_price` (
  `id` int(11) NOT NULL,
  `loan_id` int(11) NOT NULL,
  `gram_price` int(11) NOT NULL,
  `is_realtime` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `gold_price`
--

INSERT INTO `gold_price` (`id`, `loan_id`, `gram_price`, `is_realtime`) VALUES
(1, 2, 14450, 1);

-- --------------------------------------------------------

--
-- Table structure for table `gold_purity`
--

CREATE TABLE `gold_purity` (
  `id` int(11) NOT NULL,
  `loan_id` int(11) NOT NULL,
  `purity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `gold_purity`
--

INSERT INTO `gold_purity` (`id`, `loan_id`, `purity`) VALUES
(12, 2, 22),
(15, 2, 21),
(17, 2, 20);

-- --------------------------------------------------------

--
-- Table structure for table `gold_type`
--

CREATE TABLE `gold_type` (
  `id` int(11) NOT NULL,
  `loan_id` int(11) NOT NULL,
  `item_name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `gold_type`
--

INSERT INTO `gold_type` (`id`, `loan_id`, `item_name`) VALUES
(1, 2, 'Chain'),
(2, 2, 'Ring');

-- --------------------------------------------------------

--
-- Table structure for table `loan_type`
--

CREATE TABLE `loan_type` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `icon` varchar(50) NOT NULL,
  `category_type` varchar(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `loan_type`
--

INSERT INTO `loan_type` (`id`, `name`, `icon`, `category_type`) VALUES
(1, 'Bike Loan', 'fas fa-motorcycle', 'Asset-Backed'),
(2, 'Gold Loan', 'fas fa-coins', 'Collateralized');

-- --------------------------------------------------------

--
-- Table structure for table `razorpay_transaction`
--

CREATE TABLE `razorpay_transaction` (
  `id` int(11) NOT NULL,
  `amount` int(11) NOT NULL,
  `razorpay_payment_id` varchar(40) NOT NULL,
  `digital_signature` varchar(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `razorpay_transaction`
--

INSERT INTO `razorpay_transaction` (`id`, `amount`, `razorpay_payment_id`, `digital_signature`) VALUES
(31, 8111, 'pay_SY7aooHS75x0fV', '9d3aaa9a3c86aa639ef1b3164ebe3365'),
(32, 11372, 'pay_SY7dnU1avNDYjW', 'ff8feafca78b65c14360c75dc2c1926a'),
(33, 16372, 'pay_SY7fXd6O4uqozr', 'b735a4e2c574dd94f604be6f1cf23916');

-- --------------------------------------------------------

--
-- Table structure for table `site_settings`
--

CREATE TABLE `site_settings` (
  `id` int(11) NOT NULL DEFAULT 1,
  `maintenance_mode` tinyint(1) DEFAULT 0,
  `contact_number` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `company_address` text DEFAULT NULL,
  `facebook_url` text DEFAULT NULL,
  `instagram_url` text DEFAULT NULL,
  `linkedin_url` text DEFAULT NULL,
  `map_url` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `site_settings`
--

INSERT INTO `site_settings` (`id`, `maintenance_mode`, `contact_number`, `email`, `company_address`, `facebook_url`, `instagram_url`, `linkedin_url`, `map_url`, `updated_at`) VALUES
(1, 0, '9876543210', 'support@fintrack.in', 'Office 402, 4th Floor, Platinum Business Hub, Opposite Vesu Garden, VIP Road, Vesu, Surat, Gujarat - 395007', 'https://www.facebook.com/fintrack_india', 'https://www.instagram.com/fintrack_official', 'https://www.linkedin.com/company/fintrack-solutions', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d119066.41709405465!2d72.73989481267493!3d21.159340291931002!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be04e59411d1563%3A0xfe4558290938b042!2sSurat%2C%20Gujarat!5e0!3m2!1sen!2sin!4v1709990000000!5m2!1sen!2sin', '2026-03-10 17:42:57');

-- --------------------------------------------------------

--
-- Table structure for table `spread_settings`
--

CREATE TABLE `spread_settings` (
  `id` int(11) NOT NULL,
  `loan_id` int(11) NOT NULL,
  `interest_spread` float NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `spread_settings`
--

INSERT INTO `spread_settings` (`id`, `loan_id`, `interest_spread`) VALUES
(25, 1, 6),
(27, 2, 3.5);

-- --------------------------------------------------------

--
-- Table structure for table `staff`
--

CREATE TABLE `staff` (
  `id` int(11) NOT NULL,
  `full_name` varchar(50) NOT NULL,
  `address` text NOT NULL,
  `city` varchar(50) NOT NULL,
  `mob_number` varchar(12) NOT NULL,
  `gender` varchar(10) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(100) NOT NULL,
  `dob` date NOT NULL,
  `joining_date` date NOT NULL,
  `profile_image` varchar(255) NOT NULL DEFAULT 'default_staff_image.png',
  `is_temporary` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `staff`
--

INSERT INTO `staff` (`id`, `full_name`, `address`, `city`, `mob_number`, `gender`, `email`, `password`, `dob`, `joining_date`, `profile_image`, `is_temporary`, `created_at`) VALUES
(1, 'Amish Patel', 'S6/7, Bejanwala Shopping Center, Tadwadi', 'Surat', '9510640791', 'Male', 'staff@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$KF1w2lMmWTet5kwkeOGwgQ$JMCv+ZkUZ84LIXdQUpCcGMW6oMIw9U5PW8NQTc5H6IY', '2026-03-04', '2026-03-10', 'staff_1_staff_images.jpg', 0, '2026-03-14 17:56:58');

-- --------------------------------------------------------

--
-- Table structure for table `staff_passkeys`
--

CREATE TABLE `staff_passkeys` (
  `id` int(11) NOT NULL,
  `staff_id` int(11) NOT NULL,
  `credential_id` varbinary(1024) NOT NULL,
  `public_key` varbinary(1024) NOT NULL,
  `sign_count` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `staff_passkeys`
--

INSERT INTO `staff_passkeys` (`id`, `staff_id`, `credential_id`, `public_key`, `sign_count`) VALUES
(10, 1, 0x274305480bbccc5959de464c3c70de322526e72cf6e767bea700914ef04fb354, 0xa501020326200121582001d6345fea636d9f539791eb14142800cd5c49581601107118647c9140a09be02258202134d44c6ea05e4c3befa02953987ffc228672cec329e8d5c7290d1b7ef1d39d, 3);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(100) DEFAULT NULL,
  `mobile_number` varchar(10) DEFAULT NULL,
  `gender` varchar(50) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `address` text NOT NULL,
  `city` varchar(50) NOT NULL,
  `profile_image` varchar(255) DEFAULT 'default-user-image.png',
  `is_temp` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `email`, `password`, `mobile_number`, `gender`, `dob`, `address`, `city`, `profile_image`, `is_temp`) VALUES
(26, 'Uday Patel', 'udayp@example.com', '$argon2id$v=19$m=65536,t=3,p=4$aCAeDNLSeM9K2atKQ3Dc+w$KJtgW1hN0Q9H6/INle5+o+oCPm507R2WdifCRlxGLjg', '9510690461', 'Male', '2004-02-28', 'Morarji Vasahat Aanganvadi Pase Road 09 Udhana', 'Surat', 'default-user-image.png', 0);

-- --------------------------------------------------------

--
-- Table structure for table `user_details`
--

CREATE TABLE `user_details` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `aadhar_card_photo` varchar(255) DEFAULT NULL,
  `pan_card_photo` varchar(255) NOT NULL,
  `passport_photo` varchar(255) DEFAULT NULL,
  `light_bill_photo` varchar(255) DEFAULT NULL,
  `recent_credit_score` int(11) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_details`
--

INSERT INTO `user_details` (`id`, `user_id`, `aadhar_card_photo`, `pan_card_photo`, `passport_photo`, `light_bill_photo`, `recent_credit_score`, `status`, `created_at`, `updated_at`) VALUES
(13, 26, 'user_26_aadhar_card_1775022553.jpg', 'user_26_pan_card_1775022553.jpg', 'user_26_passport_1775022553.jpg', 'user_26_light_bill_1775022553.webp', 758, 'approved', '2026-04-01 05:49:13', '2026-04-01 05:56:39');

-- --------------------------------------------------------

--
-- Table structure for table `user_passkeys`
--

CREATE TABLE `user_passkeys` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `credential_id` varbinary(1024) NOT NULL,
  `public_key` varbinary(1024) NOT NULL,
  `sign_count` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_passkeys`
--

INSERT INTO `user_passkeys` (`id`, `user_id`, `credential_id`, `public_key`, `sign_count`) VALUES
(17, 26, 0xcbe90db7f9c4c61e2bc3acf8398751765fbd26b00cf1f28e7cdac8aa00b7d4fe, 0xa5010203262001215820a80c5090c687c8ef5a0bee99cd086593245fe45d1a824d42cd06b34ff382a616225820b868b4b85c5113a7f26e6ad7f349c1e1bf35527c69713788f92490627d85432a, 0);

-- --------------------------------------------------------

--
-- Table structure for table `wallet_transaction`
--

CREATE TABLE `wallet_transaction` (
  `id` int(11) NOT NULL,
  `wallet_id` int(11) NOT NULL,
  `amount` int(11) NOT NULL,
  `payment_id` varchar(40) NOT NULL,
  `trans_type` varchar(20) NOT NULL DEFAULT 'credit',
  `digital_signature` varchar(40) NOT NULL,
  `created_at` date NOT NULL DEFAULT current_timestamp(),
  `payment_time` time DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `wallet_transaction`
--

INSERT INTO `wallet_transaction` (`id`, `wallet_id`, `amount`, `payment_id`, `trans_type`, `digital_signature`, `created_at`, `payment_time`) VALUES
(73, 4, 5000, 'pay_SY7cgSbwn6AcY7', 'credit', 'cec6002ac86685ee23a2f0dc445ba572', '2026-04-01', '11:30:50'),
(74, 4, 5000, 'SPLIT_WLT_00035_00001', 'debit', '19e19f45357122e9865ceb0841054870', '2026-04-01', '11:31:24');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `admin_passkeys`
--
ALTER TABLE `admin_passkeys`
  ADD PRIMARY KEY (`id`),
  ADD KEY `admin_id` (`admin_id`);

--
-- Indexes for table `bike_loan_emi`
--
ALTER TABLE `bike_loan_emi`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_bike_loan_request_id_bike_emi` (`bike_loan_request_id`),
  ADD KEY `fk_razorpay_transaction_id_` (`razorpay_transaction_id`),
  ADD KEY `fk_wallet_transaction_id_` (`wallet_transaction_id`);

--
-- Indexes for table `bike_loan_request`
--
ALTER TABLE `bike_loan_request`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_customer_bike` (`customer_id`),
  ADD KEY `fk_bike_model` (`bike_id`);

--
-- Indexes for table `bike_master`
--
ALTER TABLE `bike_master`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_bike_loan_id` (`loan_id`);

--
-- Indexes for table `contact_inquiries`
--
ALTER TABLE `contact_inquiries`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `digital_wallet`
--
ALTER TABLE `digital_wallet`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_wallet_balance_link` (`customer_id`);

--
-- Indexes for table `gold_loan_emi`
--
ALTER TABLE `gold_loan_emi`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_gold_loan_request_id_gold_emi` (`gold_loan_request_id`),
  ADD KEY `fk_razorpay_transaction_id` (`razorpay_transaction_id`),
  ADD KEY `fk_wallet_transaction_id` (`wallet_transaction_id`);

--
-- Indexes for table `gold_loan_request`
--
ALTER TABLE `gold_loan_request`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_customer_gold` (`customer_id`),
  ADD KEY `fk_gold_loan_type_id` (`gold_loan_type_id`),
  ADD KEY `fk_loan_type_gold` (`gold_loan_id`),
  ADD KEY `fk_gold_loan_purity_` (`gold_loan_purity_id`);

--
-- Indexes for table `gold_price`
--
ALTER TABLE `gold_price`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_gold_loan_id_for_price` (`loan_id`);

--
-- Indexes for table `gold_purity`
--
ALTER TABLE `gold_purity`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_gold_loan_purity` (`loan_id`);

--
-- Indexes for table `gold_type`
--
ALTER TABLE `gold_type`
  ADD PRIMARY KEY (`id`),
  ADD KEY `gold_type_ibfk_1` (`loan_id`);

--
-- Indexes for table `loan_type`
--
ALTER TABLE `loan_type`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `razorpay_transaction`
--
ALTER TABLE `razorpay_transaction`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `site_settings`
--
ALTER TABLE `site_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `spread_settings`
--
ALTER TABLE `spread_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_loan_id` (`loan_id`);

--
-- Indexes for table `staff`
--
ALTER TABLE `staff`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `staff_passkeys`
--
ALTER TABLE `staff_passkeys`
  ADD PRIMARY KEY (`id`),
  ADD KEY `staff_id` (`staff_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_details`
--
ALTER TABLE `user_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `user_passkeys`
--
ALTER TABLE `user_passkeys`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `wallet_transaction`
--
ALTER TABLE `wallet_transaction`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_wallet_transaction_link` (`wallet_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin`
--
ALTER TABLE `admin`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `admin_passkeys`
--
ALTER TABLE `admin_passkeys`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `bike_loan_emi`
--
ALTER TABLE `bike_loan_emi`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `bike_loan_request`
--
ALTER TABLE `bike_loan_request`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `bike_master`
--
ALTER TABLE `bike_master`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `contact_inquiries`
--
ALTER TABLE `contact_inquiries`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `digital_wallet`
--
ALTER TABLE `digital_wallet`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `gold_loan_emi`
--
ALTER TABLE `gold_loan_emi`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=92;

--
-- AUTO_INCREMENT for table `gold_loan_request`
--
ALTER TABLE `gold_loan_request`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT for table `gold_price`
--
ALTER TABLE `gold_price`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `gold_purity`
--
ALTER TABLE `gold_purity`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `gold_type`
--
ALTER TABLE `gold_type`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `loan_type`
--
ALTER TABLE `loan_type`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `razorpay_transaction`
--
ALTER TABLE `razorpay_transaction`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `spread_settings`
--
ALTER TABLE `spread_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `staff`
--
ALTER TABLE `staff`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `staff_passkeys`
--
ALTER TABLE `staff_passkeys`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `user_details`
--
ALTER TABLE `user_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `user_passkeys`
--
ALTER TABLE `user_passkeys`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `wallet_transaction`
--
ALTER TABLE `wallet_transaction`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=75;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `admin_passkeys`
--
ALTER TABLE `admin_passkeys`
  ADD CONSTRAINT `admin_passkeys_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admin` (`id`);

--
-- Constraints for table `bike_loan_emi`
--
ALTER TABLE `bike_loan_emi`
  ADD CONSTRAINT `fk_bike_loan_request_id_bike_emi` FOREIGN KEY (`bike_loan_request_id`) REFERENCES `bike_loan_request` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_razorpay_transaction_id_` FOREIGN KEY (`razorpay_transaction_id`) REFERENCES `razorpay_transaction` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_wallet_transaction_id_` FOREIGN KEY (`wallet_transaction_id`) REFERENCES `wallet_transaction` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bike_loan_request`
--
ALTER TABLE `bike_loan_request`
  ADD CONSTRAINT `fk_bike_model` FOREIGN KEY (`bike_id`) REFERENCES `bike_master` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_customer_bike` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bike_master`
--
ALTER TABLE `bike_master`
  ADD CONSTRAINT `fk_bike_loan_id` FOREIGN KEY (`loan_id`) REFERENCES `loan_type` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `digital_wallet`
--
ALTER TABLE `digital_wallet`
  ADD CONSTRAINT `fk_wallet_balance_link` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `gold_loan_emi`
--
ALTER TABLE `gold_loan_emi`
  ADD CONSTRAINT `fk_gold_loan_request_id_gold_emi` FOREIGN KEY (`gold_loan_request_id`) REFERENCES `gold_loan_request` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_razorpay_transaction_id` FOREIGN KEY (`razorpay_transaction_id`) REFERENCES `razorpay_transaction` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_wallet_transaction_id` FOREIGN KEY (`wallet_transaction_id`) REFERENCES `wallet_transaction` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `gold_loan_request`
--
ALTER TABLE `gold_loan_request`
  ADD CONSTRAINT `fk_customer_gold` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_gold_loan_purity_` FOREIGN KEY (`gold_loan_purity_id`) REFERENCES `gold_purity` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_gold_loan_type_id` FOREIGN KEY (`gold_loan_type_id`) REFERENCES `gold_type` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_loan_type_gold` FOREIGN KEY (`gold_loan_id`) REFERENCES `loan_type` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `gold_price`
--
ALTER TABLE `gold_price`
  ADD CONSTRAINT `fk_gold_loan_id_for_price` FOREIGN KEY (`loan_id`) REFERENCES `gold_type` (`id`);

--
-- Constraints for table `gold_purity`
--
ALTER TABLE `gold_purity`
  ADD CONSTRAINT `fk_gold_loan_purity` FOREIGN KEY (`loan_id`) REFERENCES `loan_type` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_loan_purity` FOREIGN KEY (`loan_id`) REFERENCES `loan_type` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `gold_type`
--
ALTER TABLE `gold_type`
  ADD CONSTRAINT `gold_type_ibfk_1` FOREIGN KEY (`loan_id`) REFERENCES `loan_type` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `spread_settings`
--
ALTER TABLE `spread_settings`
  ADD CONSTRAINT `fk_loan_id` FOREIGN KEY (`loan_id`) REFERENCES `loan_type` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `staff_passkeys`
--
ALTER TABLE `staff_passkeys`
  ADD CONSTRAINT `staff_passkeys_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`);

--
-- Constraints for table `user_details`
--
ALTER TABLE `user_details`
  ADD CONSTRAINT `user_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_passkeys`
--
ALTER TABLE `user_passkeys`
  ADD CONSTRAINT `user_passkeys_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `wallet_transaction`
--
ALTER TABLE `wallet_transaction`
  ADD CONSTRAINT `fk_wallet_transaction_link` FOREIGN KEY (`wallet_id`) REFERENCES `digital_wallet` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
