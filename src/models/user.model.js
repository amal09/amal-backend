import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema({
    userName: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    avatar:{
        type: String,       //cloudinary url
        required: true,
    },
    coverImage:{
        type: String,
    },
    watchHistory: [
        {
        type: Schema.Types.ObjectId,
        ref: "Video"
    }
    ],
    password: {
        type: String,
        required: [true, "Please provide a password"]
    },
    refreshToken: {
        type: String
    }   
},
 {timestamps: true});

userSchema.pre("save", async function(next) {
    if( !this.isModified("password"))  
        return next();
    this.password = await bcrypt.hash(this.password, 10);
    next(); 
})

userSchema.methods.isPasswordCorrect = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
}

userSchema.methods.generateAccessTokens = function() {
    jwt.sign({
        _id: this._id,
        userName: this.userName,
        email: this.email,
        fullName: this.fullName
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    })
}

userSchema.methods.generateRefreshTokens = function() {
    jwt.sign({
        _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    })
}


export const User = mongoose.model("User", userSchema)