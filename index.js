const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config(); // Load environment variables from .env file

// Initialize express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect("mongodb+srv://abdulsameed:sameed%40123@cluster0.vgwcg.mongodb.net/todoApp?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.once("open", () => console.log("MongoDB connected"));

// User Schema
const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  cnic: String,
  password: String, // Hashed password
});

const User = mongoose.model("User", userSchema);

// Loan Schema
const loanSchema = new mongoose.Schema({
  loanDetails: Object,
  userId: mongoose.Schema.Types.ObjectId, // Reference to the User model
});

const Loan = mongoose.model("Loan", loanSchema);

// Generate Random Password
const generateRandomPassword = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return password;
};

// Function to send email with password
const sendEmail = async (userEmail, password) => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email", // Ethereal SMTP host
      port: 587, // Ethereal SMTP port
      secure: false, // Use STARTTLS for port 587
      auth: {
        user: testAccount.user, // Test account email
        pass: testAccount.pass, // Test account password
      },
    });

    const mailOptions = {
      from: '"Your Service" <no-reply@example.com>', // Sender address
      to: userEmail, // Receiver email
      subject: "Your Generated Password",
      text: `Hello,\n\nYour generated password is: ${password}\n\nThank you!`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.messageId);

    // Preview URL for Ethereal email
    console.log("Preview URL: ", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error("Error occurred while sending email:", error.message);
  }
};

// Registration Endpoint (Submit Loan)
app.post("/api/submit-loan", async (req, res) => {
  const { loanDetails, userDetails } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userDetails.email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate random password and hash it
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Save user details with hashed password
    const user = new User({
      email: userDetails.email,
      username: userDetails.username,
      cnic: userDetails.cnic,
      password: hashedPassword, // Save the hashed password
    });

    const savedUser = await user.save();

    // Save loan details associated with the user
    const loan = new Loan({
      loanDetails,
      userId: savedUser._id, // Store userId reference in loan
    });
    const savedLoan = await loan.save();

    // Send email to the user with the generated password
    await sendEmail(userDetails.email, randomPassword);

    // Combine user and loan data into one object
    const responseData = {
      user: savedUser,
      loan: savedLoan,
      randomPassword, // Return random password to the client
    };

    res.status(200).json({
      message: "User registered successfully",
      data: responseData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login Endpoint
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Create and send JWT token
    const token = jwt.sign({ id: user._id },"secret", { expiresIn: "1h" });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Test Email Endpoint (Optional)
app.get("/api/test-email", async (req, res) => {
  try {
    const testEmail = "test@example.com";
    const testPassword = "Test@1234";
    await sendEmail(testEmail, testPassword);
    res.status(200).json({ message: "Test email sent" });
  } catch (error) {
    res.status(500).json({ message: "Error sending test email", error });
  }
});

// Start Server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
