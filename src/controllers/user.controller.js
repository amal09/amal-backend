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
        console.log("decodedToken: ",decodedToken)
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

const changePassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect) throw new ApiError(401, "Old password is incorrect");

    //else update password
    user.password = newPassword;    
    await user.save({validateBeforeSave: false});   //save krne se pehle pre hook trigger hoga bcrypt hojayega
    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, req.user, "User details fetched successfully")
    )
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email} = req.body;
    if(!fullName && !email) throw new ApiError(400, "Full name or email is required");
    
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },{new: true}   // The new option is set to true to return the updated user document after the update operation is performed.
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Account details updated successfully")
    )

})

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path 
    if(!avatarLocalPath)    throw new ApiError(400, "Avatar file is missing"); 

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url) throw new ApiError(500, "Unable to upload avatar");

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path 
    if(!coverImageLocalPath)    throw new ApiError(400, "CoverImage file is missing"); 

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);      // retrieve the object from cloudinary
    if(!coverImage.url) throw new ApiError(500, "Unable to upload CoverImage");

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "CoverImage updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {userName} =  req.params;
    if(!userName?.trim) throw new ApiError(400, "Username is missing");

    const channel = await User.aggregate([ 
        {
            $match: {
                userName:   userName?.toLowerCase()
            }
        },
        {       // for subscribers
            $lookup: {
                from: "subscriptions", // Collection name (plural and lowercase)
                localField: "_id", // User's _id field      
                foreignField: "channel", // Matches with Subscription's channel field
                as: "subscribers" // Output array field containing subscribers
            }
        },
        {   // subsribed to
            $lookup: {
                from: "subscriptions", // Collection name (plural and lowercase)
                localField: "_id", // User's _id field     
                foreignField: "subscriber", // Matches with Subscription's subscription field
                as: "subscribedTo" // Output array field containing subscribers
            }
        },
        {
            $addFields: {
                subscribersCount: {$size: "$subscribers"},   //field hai isliye $subscribers
                channelsSubscribedToCount: {$size: "$subscribedTo"},
                isSubscribed:   {
                    $cond: {
                        if : { $in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }             
                }
            }
        },
        {
            $project:{      // to only show items which is set to true
                fullName:   1,
                userName:   1,
                avatar:     1,
                coverImage: 1,
                email:      1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if(!channel?.length) throw new ApiError(404, "Channel not found");
    console.log(channel)

    return res.status(200).json(
        new ApiResponse(200, channel[0], "Channel profile fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [{            // sub pipeline to get owner details
                    $lookup: {
                        from : "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [{
                            $project: {
                                fullName: 1,
                                userName: 1,
                                avatar: 1
                            }
                        },
                        {
                            $addFields: {
                                owner : {       //to overwrite the above created owner array field to owner object
                                    $first: "$owner"
                                }
                            }
                        }]
                    }
                }]
            }
        },
    ])

    return res.status(200).json(
        new ApiResponse(200, user[0].watchHistory, "Watch History fetched successfully")
    )
}) 

export {
    registerUser, 
    loginUser, 
    logoutUser,
    refreshAccessToken,
    changePassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
};