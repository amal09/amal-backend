import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export {registerUser};