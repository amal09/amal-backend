import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userID) => {
    try {
        const user = await User.findById(userID)
        const accessToken = await user.generateAccessTokens();
        const refreshToken = await user.generateRefreshTokens();
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};
    }
    catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists (either using email or using username)
    // check for images, check for avatar, if yes, upload to cloudinary
    // create user object - create entry in db
    // remove password and refresh token from user object
    // check for user creation
    // return res

    const {fullName, email, userName, password} = req.body
    console.log("email: ",email);

    if([fullName, email, userName, password].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{email}, {userName}]
    })
    if(existedUser) throw new ApiError(409, "User already exists!!!");

    if(!req.files?.avatar)    throw new ApiError(400, "Avatar is required");
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath = "";
    if(req.files?.coverImage)
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar)    throw new ApiError(400, "Avatar file is required");

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        userName: userName.toLowerCase()
    });
    // remove password and refresh token from user object

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    if(!createdUser)    throw new ApiError(400, "User creation failed");

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registed Successfully")
    );


});

const loginUser = asyncHandler(async (req, res) => {
    // req->body se data
    // username or email
    // find the user
    // password check
    // access and refresh token generation
    // send cookie
    const {email, userName, password} = req.body;
    console.log(email)
    if(!userName && !email)  throw new ApiError(400, "Username or email is required");

    const user = await User.findOne({
        $or: [{email}, {userName}]
    });

    if(!user) throw new ApiError(404, "User not found");

    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if(!isPasswordCorrect) throw new ApiError(401, "Invalid user credentials");

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200) 
    .cookie("access_token", accessToken, options)
    .cookie("refresh_token", refreshToken, options)
    .json(
        new ApiResponse(200, {
            user : loggedInUser,
            accessToken, refreshToken
        }, "Login Successful")
    );

    }
)

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined,
            }
        },
        {   // The new option is set to true to return the updated user document after the update operation is performed.
            new : true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("access_token", options)
    .clearCookie("refresh_token", options)
    .json(
        new ApiResponse(200, {}, "Logout Successful")
    )

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) throw new ApiError(401, "Unauthorized Request");

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
       
        const user = User.findById(decodedToken?._id)
        if(!user)   throw new ApiError(401, "Invalid Refresh Token");
    
        // now check both refreshTokens
        if(incomingRefreshToken !== user.refreshToken) throw new ApiError(401, "Refresh Token is expired or used");
    
        // if valid refreshToken, then generate new access and refresh token
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
    
        const options = {
            httpOnly : true,
            secure : true
        }
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Tokens refreshed successfully")
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token"); 
    }
})
export {
    registerUser, 
    loginUser, 
    logoutUser,
    refreshAccessToken
};