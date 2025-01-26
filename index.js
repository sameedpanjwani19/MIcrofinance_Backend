const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect("mongodb+srv://abdulsameed:sameed%40123@cluster0.vgwcg.mongodb.net/todoApp?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.once("open", () => console.log("MongoDB connected"));

const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  cnic: String,
  password: String,
});
const User = mongoose.model("User", userSchema);

const loanSchema = new mongoose.Schema({
  loanDetails: Object,
  userId: mongoose.Schema.Types.ObjectId,
});
const Loan = mongoose.model("Loan", loanSchema);

const generateRandomPassword = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return password;
};

const sendEmail = async (userEmail, password) => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const mailOptions = {
      from: '"Your Service" <no-reply@example.com>',
      to: userEmail,
      subject: "Your Generated Password",
      text: `Hello,\n\nYour generated password is: ${password}\n\nThank you!`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.messageId);
    console.log("Preview URL: ", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error("Error occurred while sending email:", error.message);
  }
};

app.post("/api/submit-loan", async (req, res) => {
  const { loanDetails, userDetails } = req.body;

  try {
    const existingUser = await User.findOne({ email: userDetails.email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const user = new User({
      email: userDetails.email,
      username: userDetails.username,
      cnic: userDetails.cnic,
      password: hashedPassword,
    });

    const savedUser = await user.save();

    const loan = new Loan({
      loanDetails,
      userId: savedUser._id,
    });
    const savedLoan = await loan.save();

    await sendEmail(userDetails.email, randomPassword);

    const responseData = {
      user: savedUser,
      loan: savedLoan,
      randomPassword,
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

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id }, "secret", { expiresIn: "1h" });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

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

module.exports = app;
